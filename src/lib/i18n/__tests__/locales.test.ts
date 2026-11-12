import { de } from '../locales/de';
import { en } from '../locales/en';
import { es } from '../locales/es';
import { fr } from '../locales/fr';
import { it as itLocale } from '../locales/it';
import { pt } from '../locales/pt';
import { ptPT } from '../locales/pt-PT';

function flatten(obj: object, prefix = ''): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...acc, [path]: value }
      : { ...acc, ...flatten(value, path) };
  }, {});
}

const placeholders = (s: string) => (s.match(/{{\s*\w+\s*}}/g) ?? []).sort();

// pt é o idioma base: define as chaves que todos precisam ter.
const others = { en, de, es, fr, it: itLocale, ptPT } as Record<string, object>;

describe('traduções', () => {
  const ptFlat = flatten(pt);

  it('nenhuma tradução do português está vazia', () => {
    for (const value of Object.values(ptFlat)) {
      expect(value.trim()).not.toBe('');
    }
  });

  for (const [name, locale] of Object.entries(others)) {
    const localeFlat = flatten(locale);

    it(`${name} tem exatamente as mesmas chaves que pt`, () => {
      expect(Object.keys(localeFlat).sort()).toEqual(Object.keys(ptFlat).sort());
    });

    it(`${name} não tem traduções vazias`, () => {
      for (const value of Object.values(localeFlat)) {
        expect(value.trim()).not.toBe('');
      }
    });

    it(`${name} tem as mesmas variáveis de interpolação que pt`, () => {
      for (const key of Object.keys(ptFlat)) {
        expect(placeholders(localeFlat[key])).toEqual(placeholders(ptFlat[key]));
      }
    });
  }
});
