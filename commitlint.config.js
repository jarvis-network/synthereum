const ERROR = 2;
const WARNING = 1;

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'body-max-line-length': [ERROR, 'always', 80],
    'footer-max-line-length': [ERROR, 'always', 80],
    'header-max-length': [ERROR, 'always', 130],
    'subject-empty': [WARNING, 'never'],
    'type-empty': [WARNING, 'never'],
  },
};
