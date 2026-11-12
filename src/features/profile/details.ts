import { z } from 'zod';

export const BELT_COLORS = {
  white: '#F5F5F5',
  grey: '#90949C',
  yellow: '#E8BD32',
  orange: '#E98332',
  green: '#398358',
  blue: '#2867B2',
  purple: '#8052A3',
  brown: '#80543B',
  black: '#242424',
  coral: '#B83E45',
  red: '#C83535',
} as const;
export const BELTS = Object.keys(BELT_COLORS) as (keyof typeof BELT_COLORS)[];
export const DISCIPLINES = ['gi', 'nogi', 'judo'] as const;
export const RESULTS = ['participated', 'gold', 'silver', 'bronze'] as const;
export const MAX_COMPETITIONS = 30;
export const MAX_BIO_LENGTH = 300;

export function normalizeInstagram(value: string) {
  const trimmed = value.trim();
  const link = trimmed.match(
    /^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9_.]+)\/?(?:\?[^#]*)?(?:#.*)?$/i
  );
  return link ? link[1] : trimmed.replace(/^@/, '');
}

export const competitionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  year: z.number().int().min(1900).max(new Date().getFullYear()),
  result: z.enum(RESULTS),
});

export const profileDetailsSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(MAX_BIO_LENGTH),
  instagram: z
    .string()
    .transform(normalizeInstagram)
    .pipe(
      z.union([
        z.literal(''),
        z
          .string()
          .max(30)
          .regex(/^[A-Za-z0-9_](?:[A-Za-z0-9_.]*[A-Za-z0-9_])?$/)
          .refine((value) => !value.includes('..')),
      ])
    ),
  belt: z.enum(BELTS).nullable(),
  beltDegree: z.number().int().min(0).max(6),
  disciplines: z.array(z.enum(DISCIPLINES)).max(DISCIPLINES.length),
  competitions: z.array(competitionSchema).max(MAX_COMPETITIONS),
});

export type ProfileDetails = z.infer<typeof profileDetailsSchema>;
export type Competition = z.infer<typeof competitionSchema>;

export function emptyProfileDetails(displayName = ''): ProfileDetails {
  return {
    displayName,
    bio: '',
    instagram: '',
    belt: null,
    beltDegree: 0,
    disciplines: [],
    competitions: [],
  };
}
