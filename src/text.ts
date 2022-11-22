

export const addBefore = (phrase:string, prefix: string, loose = false) => {
  if (phrase.startsWith(prefix)) {
    return phrase;
  }
  if (loose) {
    const r = new RegExp('^' + prefix, 'i');
    if (r.test(phrase)) {
      return phrase.replace(r, prefix);
    }
  }
  return `${prefix}${phrase}`
}

export const addAfter = (phrase:string, suffix: string, loose = false) => {
  if (phrase.endsWith(suffix)) {
    return phrase;
  }
  if (loose) {
    const r = new RegExp(suffix + '$', 'i');
    if (r.test(phrase)) {
      return phrase.replace(r, suffix);
    }
  }
  return `${phrase}${suffix}`
}

/**
 * turn database / snake case strings in to sentence form
 * @param phrase
 */
export const humanize = (phrase: string) => {
  return phrase.replace(/[ _-]+/g, '');
}

const letter = /[a-z]/i
export const capFirst = (phrase: string) => {
  if (!letter.test(phrase)) return phrase;
  const m = letter.exec(phrase);
  if (!m) return phrase;
  const [firstLetter] = m;
  return phrase.replace(firstLetter, firstLetter.toUpperCase());
}

export const entitle = (phrase: string) => {
  return humanize(phrase).split(' ').map(capFirst).join(' ');
}
