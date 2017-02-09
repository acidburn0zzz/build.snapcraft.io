import expect from 'expect';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import nock from 'nock';
import { isFSA } from 'flux-standard-action';
import url from 'url';

import {
  createSnaps,
  createSnapError,
  setGitHubRepository
} from '../../../../../src/common/actions/create-snap';
import * as ActionTypes from '../../../../../src/common/actions/create-snap';
import { conf } from '../../../../../src/common/helpers/config';

const middlewares = [ thunk ];
const mockStore = configureMockStore(middlewares);

describe('repository input actions', () => {
  const initialState = {
    isFetching: false,
    inputValue: '',
    repository: {
      fullName: null
    },
    statusMessage: '',
    success: false,
    error: false
  };

  let store;
  let action;

  beforeEach(() => {
    store = mockStore(initialState);
  });

  context('setGitHubRepository', () => {
    let payload = 'foo/bar';

    beforeEach(() => {
      action = setGitHubRepository(payload);
    });

    it('should create an action to update repository name', () => {
      const expectedAction = {
        type: ActionTypes.SET_GITHUB_REPOSITORY,
        payload
      };

      store.dispatch(action);
      expect(store.getActions()).toInclude(expectedAction);
    });

    it('should create a valid flux standard action', () => {
      expect(isFSA(action)).toBe(true);
    });
  });

  context('createSnaps', () => {
    const repository = {
      url: 'https://github.com/foo/bar',
      fullName: 'foo/bar',
      owner: 'foo',
      name: 'bar'
    };
    const BASE_URL = conf.get('BASE_URL');
    let scope;

    beforeEach(() => {
      scope = nock(BASE_URL);
    });

    afterEach(() => {
      nock.cleanAll();
    });

    it('redirects to /login/authenticate on successful creation', () => {
      scope.get('/api/github/snapcraft-yaml/foo/bar')
        .reply(200, {
          status: 'success',
          payload: {
            code: 'snapcraft-yaml-found',
            contents: { name: 'test-snap' }
          }
        });
      scope
        .post('/api/launchpad/snaps', {
          repository_url: repository.url,
          snap_name: 'test-snap',
          series: '16',
          channels: ['edge']
        })
        .reply(201, {
          status: 'success',
          payload: {
            code: 'snap-created',
            message: 'dummy-caveat'
          }
        });

      const location = {};
      return store.dispatch(createSnaps([ repository ], location))
        .then(() => {
          expect(url.parse(location.href, true)).toMatch({
            path: '/login/authenticate',
            query: {
              starting_url: '/foo/bar/setup',
              caveat_id: 'dummy-caveat'
            }
          });
        });
    });

    it('stores an error on failure', () => {
      scope.post('/api/launchpad/snaps')
        .reply(400, {
          status: 'error',
          payload: {
            code: 'snapcraft-yaml-no-name',
            message: 'snapcraft.yaml has no top-level "name" attribute'
          }
        });

      const location = {};
      return store.dispatch(createSnaps([ repository ], location))
        .then(() => {
          expect(location).toExcludeKey('href');
          expect(store.getActions()).toHaveActionOfType(
            ActionTypes.CREATE_SNAP_ERROR
          );
        });
    });
  });

  context('createSnapError', () => {
    let error = 'Something went wrong!';
    let id = 'foo/bar';

    beforeEach(() => {
      action = createSnapError(id, error);
    });

    it('creates an action to store error on failure', () => {
      const expectedAction = {
        type: ActionTypes.CREATE_SNAP_ERROR,
        error: true,
        payload: { id, error }
      };

      store.dispatch(action);
      expect(store.getActions()).toInclude(expectedAction);
    });

    it('creates a valid flux standard action', () => {
      expect(isFSA(action)).toBe(true);
    });
  });
});
