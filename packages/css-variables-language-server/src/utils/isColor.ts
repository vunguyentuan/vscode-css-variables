import * as culori from 'culori';

const isColor = (str: string) => {
  try {
    return !!culori.parse(str);
  } catch {
    return false;
  }
};

export default isColor;