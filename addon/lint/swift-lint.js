// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

var CodeMirror;

(function(mod) {
  if (typeof exports == 'object' && typeof module == 'object') // CommonJS
    mod(require('../../lib/codemirror'));
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
  'use strict';

  // ************
  // LINTER RULES
  // ************

  // Rules are adapted to JavaScript from https://github.com/realm/SwiftLint

  //
  // FUNCTION-BASED RULES
  //

  // Cyclomatic complexity needs to be below a certain level. This is a more
  // rough calculation of it since we don't have much ability for introspection.
  function cyclomaticComplexityRule(text, functions) {
    var foundErrors = [];
    var baseMessage = 'Cyclomatic complexity should have complexity of 10 or less; ' +
                      'the current complexity of the function ';


    // Measure the complexity of each function.
    var keyRegex = /\b(if|func|while|for|guard|case|switch|fallthrough)\b/g;
    for (var i = 0; i < functions.length; i++) {
      var currentFuncError = {
        code: functions[i].code,
        index: functions[i].index
      };
      var funcBody = currentFuncError.code;
      var currentComplexity = 0;
      // Track the number of times each keyword appears. 
      var keywordCount = {
        'if': 0,
        'func': 0,
        'while': 0,
        'for': 0,
        'guard': 0,
        'case': 0,
        'switch': 0,
        'fallthrough': 0
      };

      // Grab each keyword we can find and add to the count.
      var match = null;
      while ((match = keyRegex.exec(funcBody)) != null) {
        keywordCount[match[0]] += 1;
      }

      // Finally, we can calculate the complexity.
      currentComplexity = currentComplexity + keywordCount['if']
                                            + keywordCount['func']
                                            + keywordCount['while']
                                            + keywordCount['for']
                                            + keywordCount['guard'];
      if (keywordCount['switch'] > 0) {
        var switchComplexity = keywordCount['case'] - keywordCount['fallthrough'];
        if (switchComplexity > 0) {
          currentComplexity = currentComplexity + switchComplexity;
        }
      }

      // If the complexity is high enough, it's a lint error.
      if (currentComplexity > 10) {
        currentFuncError.severity = 'warning';
        if (currentComplexity > 20) {
          currentFuncError.severity = 'error';
        }
        currentFuncError.message = baseMessage + functions[i].name + ' is ' + 
                                   currentComplexity + '.';
        foundErrors.push(currentFuncError);
      }
    }

    return foundErrors;
  }

  // TODO: ForceUnwrappingRule

  // Function bodies should not be too long.
  function functionBodyLengthRule(text, functions) {
    var foundErrors = [];
    var baseMessage = 'Functions bodies should not span too many lines. The function ';

    for (var i = 0; i < functions.length; i++) {
      var currentFuncError = {
        code: functions[i].code,
        index: functions[i].index
      };
      var lineArray = currentFuncError.code.split('\n');
      if (lineArray.length > 40) {
        currentFuncError.severity = 'warning';
        if (lineArray.length > 100) {
          currentFuncError.severity = 'error';
        }
        currentFuncError.message = baseMessage + functions[i].name + ' currently has ' +
                                   lineArray.length + ' lines.';
        foundErrors.push(currentFuncError);
      }
    }

    return foundErrors;
  }

  // Functions should not have too many parameters.
  function functionParameterCountRule(text, functions) {
    var foundErrors = [];
    var baseMessage = 'Number of function parameters should be low. The function ';

    // Loop over and do this for every function.
    for (var i = 0; i < functions.length; i++) {
      var currentFuncError = {
        code: functions[i].code,
        index: functions[i].index
      };

      // If we have too many parameters, log an error.
      if (functions[i].paramCount > 5) {
        currentFuncError.severity = 'warning';
        if (functions[i].paramCount > 8) {
          currentFuncError.severity = 'error';
        }
        currentFuncError.message = baseMessage + functions[i].name + ' currently has ' +
                                   functions[i].paramCount + ' parameters.';
        foundErrors.push(currentFuncError);
      }
    }

    return foundErrors;
  }

  // Lines should not be too long.
  function lineLengthRule(text) {
    var foundErrors = [];
    var baseMessage = 'Lines should not span too many characters. This line ' +
                      'currently has ';

    // Split the text into lines and test each one.
    var splitLines = text.split('\n');
    for (var i = 0; i < splitLines.length; i++) {
      var currentLine = splitLines[i];
      if (currentLine.length > 100) {
        var lineError = {
          code: currentLine,
          index: LINE_NUMBERS[i],
          severity: 'warning',
          message: baseMessage + currentLine.length.toString() + ' characters.'
        };
        if (currentLine.length > 200) {
          lineError.severity = 'error';
        }
        foundErrors.push(lineError);
      }
    }

    return foundErrors;
  }

  // Functions should not be nested too deeply.
  function nestingFuncRule(text, functions) {
    var foundErrors = [];
    var baseMessage = 'Functions should not be nested more than five levels deep. ' +
                      'The function ';

    for (var i = 0; i < functions.length; i++) {
      if (functions[i].maxDepth > 5) {
        var currentFuncError = {
          code: functions[i].code,
          index: functions[i].index,
          severity: 'warning',
          message: baseMessage + functions[i].name + ' has a maximum depth of ' + 
                   functions[i].maxDepth + ' levels.'
        };
        foundErrors.push(currentFuncError);
      }
    }

    return foundErrors;
  }

  // A quick function to get all variables out of tuples.
  function getVariablesFromTuples(tuple, tupleIndex, staticImmutable) {
    var tupleVars = [];
    var varRegex = /\w+/g;
    var match = null;
    while ((match = varRegex.exec(tuple)) != null) {
      tupleVars.push({
        name: match[0],
        staticImmutable: staticImmutable,
        index: match.index + tupleIndex
      });
    }

    return tupleVars;
  }

  // A function that tests our variable names for correctness and offers specific
  // error messages as to what is wrong.
  function testVariableName(variable) {
    var immutableTest = /^_?(?:[a-z][A-Za-z0-9]*|[A-Z0-9]+)$/;
    var mutableTest = /^_?[A-Za-z][A-Za-z0-9]*$/;

    var errorObject = {
      code: variable.name,
      index: variable.index,
      severity: 'warning'
    };

    // Too short?
    if (variable.name.length < 3) {
      if (variable.name.length < 2) {
        errorObject.severity = 'error';
      }
      errorObject.message = 'Variable names should be at least three characters long.';
      return errorObject;
    }

    // Too long?
    if (variable.name.length > 40) {
      if (variable.name.length > 60) {
        errorObject.severity = 'error';
      }
      errorObject.message = 'Variable names should not be more than 40 characters long.';
      return errorObject;
    }

    // Otherwise malformed?
    if (!variable.staticImmutable) {
      if (!immutableTest.test(variable.name)) {
        errorObject.message = 'Variable names should only contain alphanumeric characters. ' +
                              'Mutable variable names should either start with a lowercase letter ' +
                              'or only contain capital letters.';
        return errorObject;
      }
    } else {
      if (!mutableTest.test(variable.name)) {
        errorObject.message = 'Variable names should only contain alphanumeric characters.';
        return errorObject;
      }
    }

    return null;
  }

  // Variable names should have certain properties.
  function variableNameRule(text, functions) {
    var foundErrors = [];

    // A pretty gross regex to capture all declared variables.
    // It needs to be ugly because variables can be declared in tuples.
    var allVariables = [];
    var variableRegex = /(static)?\s*(var|let)\s+(?:(\w+)|\(((?:\w+(?:\,\s+)?)+)\))/g;
    var match = null;
    while ((match = variableRegex.exec(text)) != null) {
      // If a variable is static and immutable, its first letter can be capitalized.
      var staticImmutable = false;
      if (match[1] && match[2] == 'let') {
        staticImmutable = true;
      }

      // Get the index of the variable, or the tuples, relative to the code.
      var matchText = match[4] ? match[4] : match[3];
      var varIndex = text.substring(match.index).indexOf(matchText) + match.index;
      // Ignore one leading underscore.
      if (matchText.charAt(0) == '_') {
        matchText = matchText.substring(1);
        varIndex++;
      }

      // If the user is declaring tuples, extract them.
      if (match[4]) {
        allVariables = allVariables.concat(getVariablesFromTuples(matchText, varIndex, staticImmutable));
      } else {
        allVariables.push({
          name: matchText,
          staticImmutable: staticImmutable,
          index: varIndex
        });
      }
    }

    // Let's also loop over any functions to check their parameters the same way.
    for (var i = 0; i < functions.length; i++) {
      var currentFunc = functions[i];
      // Getting the overall text index of a function parameter is not easy.
      var paramsIndex = currentFunc.index + currentFunc.code.indexOf('(') + 1;

      // We can re-use this function; it works just as well on parameters.
      allVariables = allVariables.concat(getVariablesFromTuples(currentFunc.params, paramsIndex, false));
    }

    // Now check every variable to see if it follows our rules.
    for (i = 0; i < allVariables.length; i++) {
      var currentVarError = testVariableName(allVariables[i]);
      if (currentVarError) {
        foundErrors.push(currentVarError);
      }
    }

    return foundErrors;
  }

  // All the function-based rules that require functions or no structures.
  var allFunctionRules = [cyclomaticComplexityRule, functionBodyLengthRule, functionParameterCountRule,
                          lineLengthRule, nestingFuncRule, variableNameRule];

  //
  // TYPE-BASED RULES
  //

  // Types should not be nested at all.
  function nestingTypeRule(text, types) {
    var foundErrors = [];
    var baseMessage = 'Types should not be nested more than one level deep. The ';

    for (var i = 0; i < types.length; i++) {
      if (types[i].maxDepth > 1) {
        var currentTypeError = {
          code: types[i].code,
          index: types[i].index,
          severity: 'warning',
          message: baseMessage + types[i].type + ' ' + types[i].name + ' has a maximum depth of ' +
                   types[i].maxDepth + ' levels.'
        };
        foundErrors.push(currentTypeError);
      }
    }

    return foundErrors;
  }

  // Types should not span too many lines.
  function typeBodyLengthRule(text, types) {
    var foundErrors = [];
    var baseMessage = 'Type bodies should not span too many lines. The ';

    for (var i = 0; i < types.length; i++) {
      var currentTypeError = {
        code: types[i].code,
        index: types[i].index
      };
      var lineArray = currentTypeError.code.split('\n');
      if (lineArray.length > 200) {
        currentTypeError.severity = 'warning';
        if (lineArray.length > 350) {
          currentTypeError.severity = 'error';
        }
        currentTypeError.message = baseMessage + types[i].type + ' ' + types[i].name + 
                                   ' currently has ' + lineArray.length + ' lines.';
        foundErrors.push(currentTypeError);
      }
    }

    return foundErrors;
  }

  // Type names should have certain properties.
  function typeNameRule(text, types) {
    var foundErrors = [];
    var baseMessage = 'Type names should contain only alphanumeric characters, ' +
                       'begin with an uppercase letter and span between 3 and 40 ' +
                       'characters in length.';

    // We also need to look for type names declared with typealias.
    var typealiases = [];
    var typealiasRegex = /typealias\s+(\w+)/g;
    var match = null;
    while ((match = typealiasRegex.exec(text)) != null) {
      typealiases.push({
        code: match[0],
        index: match.index,
        name: match[1]
      });
    }
    var allTypes = types.concat(typealiases);

    for (var i = 0; i < allTypes.length; i++) {
      var typeName = allTypes[i].name;
      if (!/^[A-Z][A-Za-z0-9]{2,39}$/.test(typeName)) {
        foundErrors.push({
          code: allTypes[i].code,
          index: allTypes[i].index,
          severity: 'warning',
          message: baseMessage
        });
      }
    }

    return foundErrors;
  }

  // All the function-basde rules that require types.
  var allTypeRules = [nestingTypeRule, typeBodyLengthRule, typeNameRule];

  //
  // REGEX-BASED RULES
  //

  // Make sure there is no unnecessary whitespace between a } and a ).
  var closingBraceRule = {
    rePatterns: [/\}[ \t]+\)/g],
    severity: 'warning',
    message: 'Closing brace with closing parenthesis should not have any ' + 
             'whitespace in the middle.'
  };
  // Make sure that the colon for a type declaration is next to the identifier.
  var colonRule = {
    rePatterns: [/(\w)(?:\s+:\s*|:(?:\s{0}))([\[|\(]*\S)/g],
    severity: 'warning',
    message: 'Colons should be next to the identifier when specifying a type ' +
             'and the type should not be immediately next to the colon.'
  };
  // Commas should have no space before them and one space after them.
  var commaRule = {
    rePatterns: [/\S(\s+,[\s\t\p{Z}]*|,(?:[\s\t\p{Z}]{0}|[\s\t\p{Z}]{2,}))(\S)/g],
    severity: 'warning',
    message: 'There should be no space before and one after any comma.'
  };
  // Conditional statements should return on the next line.
  var conditionalReturnsOnNewlineRule = {
    rePatterns: [/(guard|if)[^\n]*return[^\n]\n*/g],
    severity: 'warning',
    message: 'Conditional statements should always return on the next line.'
  };
  // Make sure conditional statements don't have their conditionals in ().
  var controlStatementRule = {
    rePatterns: [
      /guard\s*\([^,{]*\)\s*else\s*\s{/g,
      /if\s*\([^,{]*\)\s*\{/g,
      /for\s*\([^,{]*\)\s*\{/g,
      /switch\s*\([^,{]*\)\s*\{/g,
      /while\s*\([^,{]*\)\s*\{/g
    ],
    severity: 'warning',
    message: 'Conditional statements should not wrap their conditionals ' +
             'in parentheses.'
  };
  // It's better to use isEmpty than check if count is zero.
  var emptyCountRule = {
    rePatterns: [/\.count\s*(==|!=|<|<=|>|>=)\s*0/g],
    severity: 'error',
    message: 'Prefer checking \'isEmpty\' over comparing \'count\' to zero.'
  };
  // Try to avoid force casting. (Created differently so that it doesn't mark everything
  // in the below source code as yellow.)
  var forceCastRule = {
    rePatterns: [new RegExp('as!', 'g')],
    severity: 'error',
    message: 'Force casts should be avoided.'
  };
  // Try to avoid force trying.
  var forceTryRule = {
    rePatterns: [new RegExp('try!', 'g')],
    severity: 'error',
    message: 'Force tries should be avoided.'
  };
  // Files should not have leading whitespace.
  var leadingWhitespaceRule = {
    rePatterns: [/^[\s]+/g],
    severity: 'warning',
    message: 'Files should not contain leading whitespace.'
  };
  // Discourage legacy NS geometry functions.
  var legacyNSGeometryFunctions = ['NSWidth','NSHeight','NSMinX','NSMidX','NSMaxX','NSMinY',
                                   'NSMidY','NSMaxY','NSEqualRects','NSEqualSizes','NSEqualPoints',
                                   'NSEdgeInsetsEqual','NSIsEmptyRect','NSIntegralRect',
                                   'NSInsetRect','NSOffsetRect','NSUnionRect','NSIntersectionRect',
                                   'NSContainsRect','NSPointInRect','NSIntersectsRect'];
  var legacyNSGeometryFunctionsRule = {
    rePatterns: [new RegExp('\\b(' + legacyNSGeometryFunctions.join('|') + ')\\b', 'g')],
    severity: 'warning',
    message: 'Struct extension properties and methods are preferred over legacy functions.'
  };
  // Opening braces should be on the same line as the declaration with a space between.
  var openingBraceRule = {
    rePatterns: [/((?:[^\( ]|[\s\(][\s]+)\{)/g],
    exceptions: [/(?:if|guard|while)\n[^\{]+?[\s\t\n]\{/g],
    severity: 'warning',
    message: 'Opening braces should be preceded by a single space and on the same ' +
             'line as the declaration.'
  };
  // TODO: operator function whitespace rule.
  // Don't use '?? nil' as it is redundant.
  var redundantNilCoalescingRule = {
    rePatterns: [/\?\?\s*nil\b/g],
    severity: 'warning',
    message: 'nil coalescing operator is only evaluated if the left hand side is nil; ' +
             'coalescing operator with nil as right hand side is redundant.'
  };
  // Return arrow and return type should be separated by a single space or on a separate line.
  var spaceRegex = '[ \\f\\r\\t]';
  var incorrectSpaceRegex = '(' + spaceRegex + '{0}|' + spaceRegex + '{2,})';
  var returnArrowPatterns = [
    '(' + incorrectSpaceRegex + '\\->' + spaceRegex + '*)',
    '(' + spaceRegex + '\\->' + incorrectSpaceRegex + ')',
    '\\n' + spaceRegex + '*\\->' + incorrectSpaceRegex,
    incorrectSpaceRegex + '\\->\\n' + spaceRegex + '*'
  ];
  var returnArrowWhiteSpaceRule = {
    rePatterns: [new RegExp('\\)(' + returnArrowPatterns.join('|') + ')\\S+', 'g')],
    severity: 'warning',
    message: 'Return arrow and return type should be separated by a single space or on a ' +
             'separate line.'
  };
  // Files should end with a single newline.
  var trailingNewlineRule = {
    rePatterns: [/[^\n]+$|\n{2,}$/g],
    severity: 'warning',
    message: 'Files should have a single trailing newline.'
  };
  // Lines should not end with a trailing semicolon.
  var trailingSemicolonRule = {
    rePatterns: [/;\n|;$/g],
    severity: 'warning',
    message: 'Lines should not end with a trailing semicolon.'
  };
  // Lines should not end with trailing whitespace.
  var trailingWhitespaceRule = {
    rePatterns: [/[^\S\n](?:\n|$)/g],
    severity: 'warning',
    message: 'Lines should not end with trailing whitespace.'
  };
  // There should not be more than one line of vertical whitespace.
  var verticalWhitespaceRule = {
    rePatterns: [/\n(?:[^\S\n]*\n){2,}/g],
    severity: 'warning',
    message: 'Vertical whitespace should not be longer than one line.'
  };
  // We're skipping the file length lint rule due to the nature of the sandbox.
  var allRegexRules = [closingBraceRule, colonRule, commaRule, conditionalReturnsOnNewlineRule,
                       controlStatementRule, emptyCountRule, forceCastRule, forceTryRule,
                       leadingWhitespaceRule, legacyNSGeometryFunctionsRule, openingBraceRule,
                       redundantNilCoalescingRule, returnArrowWhiteSpaceRule, trailingNewlineRule,
                       trailingSemicolonRule, trailingWhitespaceRule, verticalWhitespaceRule];

  // ******************************
  // RESULTS PROCESSING AND DISPLAY
  // ******************************

  // A global array of line numbers matched to indices.
  var LINE_NUMBERS = [];
  var TEXT_LENGTH = -1;

  // This function takes the initial text and gets an array of starting
  // indices for each line, so we can more easily get line numbers out
  // of the text.
  function obtainLineNumbers(text) {
    var lineArray = text.split('\n');
    var lineNumbers = [];
    var currentIndex = 0;
    for (var i = 0; i < lineArray.length; i++) {
      // Pushing now so we can start with 0.
      lineNumbers.push(currentIndex);

      var line = lineArray[i];
      // Increment the index for the next array element, remembering to add
      // 1 for the \n that was stripped out.
      currentIndex += line.length + 1;
    }

    LINE_NUMBERS = lineNumbers;
    TEXT_LENGTH = text.length;
  }

  // Process regex exceptions and get the ranges that they encompass.
  function processExceptions(text, exceptions) {
    if (!exceptions) {
      return [];
    }

    var exceptionRanges = [];
    var match = null;
    for (var i = 0; i < exceptions.length; i++) {
      while ((match = exceptions[i].exec(text)) != null) {
        exceptionRanges.push({
          start: match.index,
          end: match.index + match[0].length
        });
      }
    }

    return exceptionRanges;
  }

  // Try to match possible rule violations with exceptions.
  function regexException(matchIndex, exceptionRanges) {
    for (var i = 0; i < exceptionRanges.length; i++) {
      var range = exceptionRanges[i];
      if (range.start <= matchIndex && range.end > matchIndex) {
        return true;
      }
    }

    return false;
  }

  // Process a rule that's entirely regex-based.
  function regexRule(text, rule) {
    var foundErrors = [];
    var exceptionRanges = processExceptions(text, rule.exceptions);

    var rePatterns = rule.rePatterns;
    var match = null;
    for (var i = 0; i < rePatterns.length; i++) {
      while ((match = rePatterns[i].exec(text)) != null) {
        if (!regexException(match.index, exceptionRanges)) {
          foundErrors.push({
            code: match[0],
            index: match.index,
            severity: rule.severity,
            message: rule.message
          });
        }
      }
    }

    return foundErrors;
  }

  // Extract function parameters from functions.
  function getFunctionParameters(functionObj) {
    // First off, see if we match a parameter-less function.
    if (/^func\s+\w+\s*\(\s*\)/.test(functionObj.code)) {
      functionObj.paramCount = 0;
      functionObj.params = null;
      return;
    }

    // Now try to match parameters.
    var paramRegex = /^func\s+\w+(.*?)\{/;
    var match = paramRegex.exec(functionObj.code);
    if (match) {
      // If we captured anything parameter-like, try to count the parameters.
      var functionInfo = match[1];
      var paramStartIndex = functionInfo.indexOf('(');
      var paramEndIndex = -1;
      var paramCount = 1;
      var depth = 0;
      for (var i = paramStartIndex; i < functionInfo.length; i++) {
        var currentChar = functionInfo.charAt(i);
        // If this is an open paren, increase depth.
        if (currentChar == '(') {
          depth += 1;
        }

        // If this is a close parens, decreae depth.
        if (currentChar == ')') {
          depth -= 1;
        }

        // If this is a comma, and we're at depth 1, that's another parameter.
        if (depth == 1 && currentChar == ',') {
          paramCount += 1;
        }

        // If we're at depth 0 after parsing a ), we have all the params, so quit.
        if (depth == 0) {
          paramEndIndex = i + 1;
          break;
        }
      }

      functionObj.paramCount = paramCount;
      // +1 and -1 will remove the parentheses.
      functionObj.params = functionInfo.substring(paramStartIndex + 1, paramEndIndex - 1);
    }
  }

  // Extract all function/type bodies from the given code, along with
  // their maximum nesting depths.
  function extractBodies(text, type) {
    // First, we use a regex to grab all body declarations and extract the name.
    var bodyDecs = [];
    var searchRegex = new RegExp('(?:^|\\b)' + type + '\\s+(\\w+)', 'g');

    var match = null;
    while ((match = searchRegex.exec(text)) != null) {
      bodyDecs.push({
        code: '',
        name: match[1],
        index: match.index,
        type: type,
        maxDepth: 0
      });
    }

    // Next, for each declaration, we capture the entire body.
    var validBodies = [];
    for (var i = 0; i < bodyDecs.length; i++) {
      var currentBody = bodyDecs[i];
      var depth = 0;
      var codeToCheck = text.substring(currentBody.index);

      // Look for either a { or } to change the current depth.
      var braceRegex = /[^\}]*?\{|[^\{]*?\}/g;
      while ((match = braceRegex.exec(codeToCheck)) != null) {
        var matchStr = match[0];
        if (matchStr.charAt(matchStr.length-1) == '{') {
          depth = depth + 1;
        } else if (matchStr.charAt(matchStr.length-1) == '}') {
          depth = depth - 1;
        }

        currentBody.code = currentBody.code.concat(matchStr);

        if (depth > currentBody.maxDepth) {
          currentBody.maxDepth = depth;
        }

        if (depth <= 0) {
          // Either the body is complete or it is malformed.
          break;
        }
      }

      // We've broken out, so check the depth to see if this structure
      // is valid.
      if (depth == 0 && currentBody.code) {
        validBodies.push(currentBody);
      }
    }

    return validBodies;
  }

  // Get all functions.
  function extractFunctions(text) {
    return extractBodies(text, 'func');
  }

  // Get all type bodies.
  function extractTypes(text) {
    var enums = extractBodies(text, 'enum');
    var structs = extractBodies(text, 'struct');
    var classes = extractBodies(text, 'class');
    return enums.concat(structs).concat(classes);
  }

  // Get the Pos object corresponding to the given index.
  function getLinePos(index) {
    for (var i = 0; i < LINE_NUMBERS.length; i++) {
      // Matching somewhere in the previous line.
      if (index < LINE_NUMBERS[i]) {
        // Decrement because it matched the previous line.
        return CodeMirror.Pos(i-1, index - LINE_NUMBERS[i-1]);
      }

      // Matching the start of the current line.
      if (index == LINE_NUMBERS[i]) {
        return CodeMirror.Pos(i, index - LINE_NUMBERS[i]);
      }

      // Edge case: error is on the last line of text.
      if (i == LINE_NUMBERS.length - 1 && index <= TEXT_LENGTH) {
        return CodeMirror.Pos(i, index - LINE_NUMBERS[i]);
      }
    }

    // Something went wrong.
    return null;
  }

  // Take raw errors returned by rules and turn them into objects
  // CodeMirror can understand.
  function processRawErrors(rawErrors) {
    var processedErrors = [];

    for (var i = 0; i < rawErrors.length; i++) {
      var rawError = rawErrors[i];
      var lengthOfErrorCode = rawError.code.length;
      var errPos = getLinePos(rawError.index);
      var errPosEnd = getLinePos(rawError.index + lengthOfErrorCode);

      // No idea how we'd get here, but better safe than sorry.
      if (!errPos || !errPosEnd) {
        continue;
      }

      processedErrors.push({
        severity: rawError.severity,
        message: rawError.message,
        from: errPos,
        to: errPosEnd
      });
    }

    return processedErrors;
  }

  // Create the function to apply rules and log errors from it.
  function applyRuleBuilder(text, structures, opts, cm) {
    return function applyRule(foundErrors, rule) {
      var results = rule(text, structures, opts, cm);
      var errors = processRawErrors(results);
      return foundErrors.concat(errors);
    };
  }

  // The main linting function.
  function swiftLint(text, opts, cm) {
    var foundErrors = [];

    // Perform pre-processing.
    obtainLineNumbers(text);
    var allFunctions = extractFunctions(text);
    for (var i = 0; i < allFunctions.length; i++) {
      getFunctionParameters(allFunctions[i]);
    }
    var applyFuncRule = applyRuleBuilder(text, allFunctions, opts, cm);
    var allTypes = extractTypes(text);
    var applyTypeRule = applyRuleBuilder(text, allTypes, opts, cm);

    // Apply regex-based rules.
    for (i = 0; i < allRegexRules.length; i++) {
      var currentRule = allRegexRules[i];
      var results = regexRule(text, currentRule);
      var errors = processRawErrors(results);
      foundErrors = foundErrors.concat(errors);
    }

    // Apply function-based rules.
    for (i = 0; i < allFunctionRules.length; i++) {
      foundErrors = applyFuncRule(foundErrors, allFunctionRules[i]);
    }
    // Apply type-based rules.
    for (i = 0; i < allTypeRules.length; i++) {
      foundErrors = applyTypeRule(foundErrors, allTypeRules[i]);
    }

    return foundErrors;
  }

  CodeMirror.registerHelper('lint', 'swift', swiftLint);

});
