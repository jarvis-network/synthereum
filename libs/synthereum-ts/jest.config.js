module.exports = {
  displayName: 'synthereum-ts',
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.(jsx?|tsx?)$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  verbose:true,
  testEnvironment: 'node',
  //coverageDirectory: '../../coverage/libs/synthereum-ts',
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
};
