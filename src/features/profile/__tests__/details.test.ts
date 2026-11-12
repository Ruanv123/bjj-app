import { emptyProfileDetails, profileDetailsSchema } from '../details';

const base = () => emptyProfileDetails('Ana');

describe('dados do atleta', () => {
  it('permite um perfil sem dados esportivos e normaliza espaços', () => {
    expect(
      profileDetailsSchema.parse({
        ...base(),
        displayName: ' Ana ',
        bio: ' Treino todos os dias ',
      })
    ).toMatchObject({
      displayName: 'Ana',
      bio: 'Treino todos os dias',
      competitions: [],
      belt: null,
    });
  });

  it.each([
    '@ana.luta',
    'ana.luta',
    'https://www.instagram.com/ana.luta/',
    'https://instagram.com/ana.luta',
    'https://www.instagram.com/ana.luta/?igsh=abc',
  ])('normaliza Instagram %s', (instagram) => {
    expect(profileDetailsSchema.parse({ ...base(), instagram }).instagram).toBe('ana.luta');
  });

  it.each(['https://outro.site/ana', 'ana/abc', 'ana..luta', 'ana.', 'ana luta', 'a'.repeat(31)])(
    'recusa Instagram inválido: %s',
    (instagram) => {
      expect(profileDetailsSchema.safeParse({ ...base(), instagram }).success).toBe(false);
    }
  );

  it('salva modalidades e resultados sem confundir participação e vitória', () => {
    const competitions = [
      { name: 'Estadual', year: 2020, result: 'participated' },
      { name: 'Brasileiro', year: 2021, result: 'gold' },
      { name: 'Regional', year: 2022, result: 'silver' },
      { name: 'Open', year: 2023, result: 'bronze' },
    ];
    expect(
      profileDetailsSchema.parse({
        ...base(),
        belt: 'blue',
        beltDegree: 2,
        disciplines: ['gi', 'nogi'],
        competitions,
      })
    ).toMatchObject({
      belt: 'blue',
      beltDegree: 2,
      disciplines: ['gi', 'nogi'],
      competitions,
    });
  });

  it.each([
    { bio: 'a'.repeat(301) },
    { displayName: '  ' },
    { beltDegree: 7 },
    { disciplines: ['invalid'] },
    { disciplines: ['mma'] },
    { disciplines: ['wrestling'] },
    { disciplines: ['muayThai'] },
    { disciplines: ['boxing'] },
    { competitions: [{ name: '', year: 2020, result: 'gold' }] },
    {
      competitions: [{ name: 'Open', year: new Date().getFullYear() + 1, result: 'gold' }],
    },
    { competitions: [{ name: 'Open', year: 2020.5, result: 'gold' }] },
    {
      competitions: Array.from({ length: 31 }, () => ({
        name: 'Open',
        year: 2020,
        result: 'gold',
      })),
    },
  ])('recusa dados inválidos: %j', (patch) => {
    expect(profileDetailsSchema.safeParse({ ...base(), ...patch }).success).toBe(false);
  });
});
