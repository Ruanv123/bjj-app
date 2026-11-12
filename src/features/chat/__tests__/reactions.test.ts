import { applyReaction, summarizeReactions } from '../types';

describe('reações', () => {
  it('agrupa por emoji, do mais usado para o menos usado, marcando a minha', () => {
    const summary = summarizeReactions({ a: '❤️', b: '👍', c: '❤️', me: '👍', d: '❤️' }, 'me');
    expect(summary).toEqual([
      { emoji: '❤️', count: 3, mine: false },
      { emoji: '👍', count: 2, mine: true },
    ]);
  });

  it('sem reações, o resumo é vazio', () => {
    expect(summarizeReactions({}, 'me')).toEqual([]);
  });

  it('uma reação por pessoa: reagir de novo troca o emoji', () => {
    expect(applyReaction({ me: '👍', a: '😂' }, 'me', '❤️')).toEqual({ me: '❤️', a: '😂' });
  });

  it('emoji nulo remove a reação sem alterar o objeto original', () => {
    const original = { me: '👍', a: '😂' };
    expect(applyReaction(original, 'me', null)).toEqual({ a: '😂' });
    expect(original).toEqual({ me: '👍', a: '😂' });
  });
});
