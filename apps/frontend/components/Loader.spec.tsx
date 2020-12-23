import { shallow } from 'enzyme';

import { Loader } from './Loader';

describe('[ Components ] Loader', () => {
  test('renders without error', () => {
    const component = shallow(<Loader />);
    expect(component.find('svg').length).toBe(1);
  });
});
