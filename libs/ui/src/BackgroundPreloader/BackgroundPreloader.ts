import { FC, useEffect } from 'react';

interface Props {
  backgrounds: string[];
}

export const BackgroundPreloader: FC<Props> = ({ backgrounds }) => {
  useEffect(() => {
    const preload = () => {
      // new Image(); preloading trick can still cause flicker sometimes

      if (document.querySelector('.bg-preloading-container')) {
        return;
      }

      const bgs = backgrounds.map(v => `url(${v})`);
      const div = document.createElement('div');
      div.className = 'bg-preloading-container';
      div.style.backgroundImage = bgs.join(', ');
      div.style.visibility = 'hidden';
      document.body.appendChild(div);
    };

    window.addEventListener('load', preload);

    return () => {
      window.removeEventListener('load', preload);
    };
  }, []);

  return null;
};
