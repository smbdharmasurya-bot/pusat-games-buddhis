import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseViewFromLocation,
  getRouteHashForView,
  isValidRouteView,
} from './routeLazySync';

test('parseViewFromLocation resolves hash routes, aliases, and fallback home route accurately', () => {
  assert.equal(parseViewFromLocation('', '/'), 'home');
  assert.equal(parseViewFromLocation('#/', '/'), 'home');
  assert.equal(parseViewFromLocation('#/games', '/'), 'catalog');
  assert.equal(parseViewFromLocation('#/catalog?cat=SD', '/'), 'catalog');
  assert.equal(parseViewFromLocation('#/featured', '/'), 'featured');
  assert.equal(parseViewFromLocation('#/leaderboard', '/'), 'leaderboard');
  assert.equal(parseViewFromLocation('#/testimonials', '/'), 'testimonials');
  assert.equal(parseViewFromLocation('', '/leaderboard'), 'leaderboard');
  assert.equal(parseViewFromLocation('#/unknown-route', '/'), 'home');
});

test('getRouteHashForView returns canonical route hashes for every valid view', () => {
  assert.equal(getRouteHashForView('home'), '#/');
  assert.equal(getRouteHashForView('catalog'), '#/games');
  assert.equal(getRouteHashForView('featured'), '#/featured');
  assert.equal(getRouteHashForView('leaderboard'), '#/leaderboard');
  assert.equal(getRouteHashForView('testimonials'), '#/testimonials');
});

test('isValidRouteView validates supported route views', () => {
  assert.equal(isValidRouteView('home'), true);
  assert.equal(isValidRouteView('catalog'), true);
  assert.equal(isValidRouteView('leaderboard'), true);
  assert.equal(isValidRouteView('admin'), false);
  assert.equal(isValidRouteView(''), false);
});
