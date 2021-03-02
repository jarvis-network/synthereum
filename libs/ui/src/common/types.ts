export interface InvertColorsOptions {
  background: string;
  primaryBackground: string;
  color: string;
  inverted?: boolean;
}

export interface CustomButtonOptions extends InvertColorsOptions {
  shadow: string;
}

export interface RoundedButtonOptions {
  borderRadius: string;
}

export interface DisabledButtonOptions {
  background: string;
  color: string;
}
