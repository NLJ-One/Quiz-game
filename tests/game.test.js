import assert from 'node:assert/strict';
import test from 'node:test';
import { Game } from '../server/game.js';
import { ANIMAL_AVATARS } from '../web/shared/avatars.js';

test('un joueur et le classement public conservent un index avatar valide', () => {
  const game = new Game({ code: '123456', quiz: { settings: {} }, hostSocket: null });
  const player = game.addPlayer({ id: 'player-1' }, { pseudo: 'Camille', avatarIndex: 17 });

  assert.equal(player.avatarIndex, 17);
  assert.equal(game.getPublicPlayers()[0].avatarIndex, 17);
  assert.equal(game.getLeaderboard()[0].avatarIndex, 17);
  assert.equal(ANIMAL_AVATARS.length, 40);
});

test('les payloads hello et classement restent compacts jusqu’à 150 joueurs', () => {
  const game = new Game({ code: '123456', quiz: { settings: { uniqueNicknames: false } }, hostSocket: null });
  const hello = { code: '123456', pseudo: 'Camille', avatarIndex: 12 };
  assert.ok(Buffer.byteLength(JSON.stringify(hello), 'utf8') < 1024);

  for (let index = 0; index < 150; index += 1) {
    game.addPlayer(
      { id: `player-${index}` },
      { pseudo: `Invité ${String(index).padStart(3, '0')}`, avatarIndex: index % ANIMAL_AVATARS.length }
    );
  }

  const hostResult = { code: game.code, players: game.getPublicPlayers() };
  assert.equal(hostResult.players.length, 150);
  assert.ok(Buffer.byteLength(JSON.stringify(hostResult), 'utf8') < 64 * 1024);
});

test('un index avatar absent ou invalide est ramené à un index sûr', () => {
  const game = new Game({ code: '123456', quiz: { settings: {} }, hostSocket: null });
  assert.equal(game.addPlayer({ id: 'player-a' }, { pseudo: 'Ana', avatarIndex: -1 }).avatarIndex, 0);
  assert.equal(game.addPlayer({ id: 'player-b' }, { pseudo: 'Sam', avatarIndex: 100 }).avatarIndex, 0);
});
