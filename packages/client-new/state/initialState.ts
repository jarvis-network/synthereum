import {ThemeNameType} from "@jarvis-network/ui";

export interface State {
  theme: ThemeNameType;
  auth: {
    state: boolean;
  },
}

const initialState: State = {
  theme: "light",
  auth: {
    state: false,
  },
};

export default initialState;
