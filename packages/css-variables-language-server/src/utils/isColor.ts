import * as culori from 'culori';

const isColor = (str: string) => {
  const colorTemp = culori.parse(str);

  return !!colorTemp;
};

export default isColor;