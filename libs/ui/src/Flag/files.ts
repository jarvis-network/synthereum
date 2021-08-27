import chf from './icons/chf.svg';
import eur from './icons/eur.svg';
import gbp from './icons/gbp.svg';
import us from './icons/us.svg';
import uma from './icons/uma.svg';

const cad = us;
const jpy = us;
const krw = us;
const ngn = us;
const php = us;
const zar = us;
const xau = us;
const spx = us;
const xti = us;
const xag = us;
const usdc = us;
export const files = {
  chf,
  eur,
  gbp,
  us,
  usdc,
  uma,
  cad,
  jpy,
  krw,
  ngn,
  php,
  zar,
  xau,
  spx,
  xti,
  xag,
};

export type FlagKeys = keyof typeof files;
