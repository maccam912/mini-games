const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

const icon = name => `<svg aria-hidden="true"><use href="#${name}"/></svg>`;
const gameURL = game => `./games/${encodeURIComponent(game.slug)}/`;
const assetURL = (game, file) => gameURL(game) + file.split('/').map(encodeURIComponent).join('/');

function saveButton(game, withLabel = false) {
  return `<button class="save-button ${withLabel ? 'hero-save' : 'row-save'}" type="button" hidden
    data-save="${escapeHTML(game.slug)}" data-title="${escapeHTML(game.title)}" aria-pressed="false"
    aria-label="Save ${escapeHTML(game.title)}" title="Save ${escapeHTML(game.title)}">
    ${icon('bookmark')}${withLabel ? '<span>Save</span>' : ''}
  </button>`;
}

function feature(game) {
  const title = escapeHTML(game.title);
  return `<section class="feature" aria-labelledby="featured-game">
    <img class="poster" src="${assetURL(game, game.cover)}" alt="" fetchpriority="high">
    <div class="feature-content">
      <div class="featured-label">${icon('spark')} Featured game</div>
      <h1 id="featured-game">${game.wordmark ? `<img class="wordmark" src="${assetURL(game, game.wordmark)}" alt="${title}">` : title}</h1>
      <p>${escapeHTML(game.description)}</p>
      <div class="feature-actions">
        <a class="play-primary" href="${gameURL(game)}">${icon('play')} Play now</a>
        ${saveButton(game, true)}
      </div>
    </div>
  </section>`;
}

function gameRow(game) {
  const title = escapeHTML(game.title);
  return `<article class="game-row" data-game="${escapeHTML(game.slug)}">
    <a class="thumb" href="${gameURL(game)}" aria-label="Play ${title}" tabindex="-1">
      <img src="${assetURL(game, game.cover)}" alt="" loading="lazy">
    </a>
    <div class="game-details">
      <h3><a href="${gameURL(game)}">${title}</a></h3>
      <div class="game-meta"><span class="genre">${escapeHTML(game.genre)}</span>
        <span class="control">${icon('controller')} ${escapeHTML(game.controls)}</span>
      </div>
    </div>
    <div class="row-actions">${saveButton(game)}
      <a class="row-play" href="${gameURL(game)}" aria-label="Play ${title}">Play ${icon('arrow')}</a>
    </div>
  </article>`;
}

export function renderDirectory(html, games) {
  const featured = games.find(game => game.featured) ?? games[0];
  return html.replace('<!-- arcade:feature -->', () => featured ? feature(featured) : '')
    .replace('<!-- arcade:games -->', () => games.map(gameRow).join('\n'))
    .replace('<!-- arcade:count -->', () => `${games.length} ${games.length === 1 ? 'game' : 'games'}`);
}
