export type RenderFunction<Element = JSX.Element> = (props: any) => Element;

export type Renderer = {
  render: RenderFunction;
};

export function isRenderer<T>(props: Renderer | T): props is Renderer {
  return 'render' in props;
}

export interface MenuItemProps {
  label: string;
  link: string;
  customMenuRender?: RenderFunction;
  [key: string]: any;
}

export interface ActionButtonProps {
  title?: string;
  onClick?: () => void;
  customButtonRender?: RenderFunction;
  [key: string]: any;
}

export type HeaderProps =
  | Renderer
  | {
      className?: string;
      link: any;
      logoUrl?: string;
      leftSide:
        | null
        | Renderer
        | {
            menu: MenuItemProps[];
          };
      rightSide:
        | null
        | Renderer
        | {
            actionButtons: ActionButtonProps[];
          };
    };
