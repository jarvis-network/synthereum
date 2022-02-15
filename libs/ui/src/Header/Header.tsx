/* eslint-disable react/destructuring-assignment */
import React from 'react';

import { styled } from '../Theme';

import { HeaderProps, isRenderer } from './types';
import { ActionButton } from './component/ActionButton';
import { MenuItem } from './component/MenuItem';

const Container = styled.div`
  align-items: center;
  display: grid;
  grid-template-columns: auto auto 1fr;
  justify-content: space-between;
  padding: 8px 13px;

  .logo {
    height: 20px;
    width: 15px;

    img {
      max-width: 100%;
    }
  }

  .card {
    border: 1px solid rgba(190, 190, 190, 0.5);
    display: flex;
    height: 29px;
    justify-content: space-between;
    padding: 8px;
    width: 158px;

    .title {
      font-size: ${props => props.theme.font.sizes.m};
    }

    .right {
      height: 9px;

      .icon {
        display: block;
        font-size: ${props => props.theme.font.sizes.xs};
        width: 9px;
      }
    }
  }
`;

const LeftSectionContainer = styled.div`
  margin-left: 20px;

  a {
    text-decoration: none;
  }

  .label {
    color: ${props => props.theme.text.secondary};
    cursor: pointer;
    font-size: ${props => props.theme.font.sizes.m};
    margin: 0 10px;
    transition: 0.2s ease;

    &:hover {
      color: ${props => props.theme.text.primary};
    }
  }
`;

const RightSectionContainer = styled.div`
  display: grid;
  grid-template-columns: auto auto;
  justify-content: end;
  margin-right: 16px;

  .button.icon {
    background: transparent;
    border: 1px solid ${props => props.theme.text.secondary};
    height: 29px;
    margin-left: 9px;
    padding: 8px;
    width: 29px;

    img {
      height: 12px;
      width: 12px;
    }
  }
`;

export const Header: React.FC<HeaderProps> = props => (
  <Container className={'className' in props ? props.className : ''}>
    {isRenderer(props) ? (
      props.render(props)
    ) : (
      <>
        <props.link to="/" className="logo">
          <img alt="Logo" src={props.logoUrl} className="header-logo" />
        </props.link>

        {props.leftSide && (
          <LeftSectionContainer>
            {isRenderer(props.leftSide)
              ? props.leftSide.render(props)
              : props.leftSide.menu.map((menuItem, index) => (
                  // (*) We don't have a unique id attached to each item, so we
                  // don't have a choice but to use the array index. Since the
                  // list is going to be static and with a small number of
                  // elements, this shouldn't be a problem in practice.
                  // eslint-disable-next-line react/no-array-index-key
                  <MenuItem key={index} routerLink={props.link} {...menuItem} />
                ))}
          </LeftSectionContainer>
        )}
        {props.rightSide && (
          <RightSectionContainer>
            {isRenderer(props.rightSide)
              ? props.rightSide.render(props)
              : props.rightSide.actionButtons.map((button, index) => (
                  // (*) same as above
                  // eslint-disable-next-line react/no-array-index-key
                  <ActionButton key={index} {...button} />
                ))}
          </RightSectionContainer>
        )}
      </>
    )}
  </Container>
);
