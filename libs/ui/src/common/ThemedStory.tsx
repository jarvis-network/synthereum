import React, { FC, ReactNode } from 'react';
import { select, boolean } from '@storybook/addon-knobs';

import { styled, ThemeProvider } from '../Theme';
import { themesList } from '../Theme/stories/data';

export const ThemedContent = styled.div`
  background-color: ${props => props.theme.background.primary};
  color: ${props => props.theme.text.primary};
  padding: 20px;
  box-sizing: border-box;
  min-height: 100vh;
`;

const TopElements: FC = () => (
  <>
    <h1>Jarvis Website</h1>
    <p style={{ marginBottom: '2em' }}>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean lobortis
      auctor eros quis fringilla. Pellentesque efficitur pharetra orci, et
      posuere lectus dignissim a. In vitae felis metus. Proin maximus purus
      velit, sed luctus erat luctus id. Donec metus nunc, iaculis nec sodales
      sit amet, cursus ut augue. Posuere a magna enim. Nulla facilisi. Praesent
      sed nunc nec odio viverra sollicitudin non a mi.
    </p>
  </>
);

const BottomElements: FC = () => (
  <>
    <p style={{ marginTop: '3em' }}>
      <small>
        Maecenas convallis est placerat sapien tincidunt sagittis. Ut hendrerit
        lacinia dolor ac vestibulum.
      </small>
    </p>
    <hr />
    <small>Jarvis {new Date().getFullYear()}</small>
  </>
);

export const ThemedStory: FC<{ children: ReactNode }> = ({ children }) => {
  const theme = select('Theme', themesList, themesList[0]);
  const layout = boolean('Put some text around', false);
  document.body.style.margin = '0'; // hacky hack, but it's only for StoryBook

  return (
    <ThemeProvider theme={theme}>
      <ThemedContent>
        {layout && <TopElements />}
        {children}
        {layout && <BottomElements />}
      </ThemedContent>
    </ThemeProvider>
  );
};
