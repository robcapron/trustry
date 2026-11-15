/** Caractères interdits, construits par code Unicode pour ne jamais apparaître en clair dans le source. */
export const FORBIDDEN_DASHES = new RegExp(`[${[0x2012, 0x2013, 0x2014, 0x2015, 0x2212].map((c) => String.fromCharCode(c)).join("")}]`);
export const EM_DASH = String.fromCharCode(0x2014);
export const EN_DASH = String.fromCharCode(0x2013);
export const MINUS_SIGN = String.fromCharCode(0x2212);
export const NBSP = String.fromCharCode(0xa0);
