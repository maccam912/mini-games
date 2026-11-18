import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDirectory } from '../scripts/render-directory.mjs';

test('the built HTML links every game and honors the featured game', () => {
  const page = '<!-- arcade:feature --><!-- arcade:games --><!-- arcade:count -->';
  const first = { title: 'A & B', slug: 'a-b', description: 'Test', controls: 'Tap', genre: 'Puzzle', cover: 'art/cover shot.png' };
  const next = { ...first, title: 'Next', slug: 'next', featured: true, wordmark: 'wordmark.svg' };
  const output = renderDirectory(page, [first, next]);
  assert.match(output, /id="featured-game"><img[^>]+games\/next\/wordmark\.svg/);
  assert.match(output, /href="\.\/games\/a-b\/">A &amp; B<\/a>/);
  assert.match(output, /games\/a-b\/art\/cover%20shot\.png/);
  assert.match(output, /data-game="next"/);
  assert.match(output, /2 games$/);
  assert.match(renderDirectory(page, [first]), /id="featured-game">A &amp; B<\/h1>/);
  assert.equal(renderDirectory(page, []), '0 games');
});
