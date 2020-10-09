export interface State {
  theme: string; // @todo use type def from ui library
}

const initialState: State = {
  theme: "light",
};

export default initialState;
