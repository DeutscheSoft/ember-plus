module.exports = {
    "env": {
        "browser": true,
        "es2015": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "sourceType": "module",
        "ecmaVersion": 8,
    },
    "rules": {
      "prefer-const" : "error",
      "no-unused-vars" : [ "error", { "args": "none" } ],
      "no-var" : "error",
      "no-empty": [ "error", { "allowEmptyCatch" : true } ]
    }
};
