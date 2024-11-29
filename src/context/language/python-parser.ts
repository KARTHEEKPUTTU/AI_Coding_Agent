import { AbstractParser, EnclosingContext } from "../../constants";

// Regular expressions for detecting Python context
const FUNCTION_REGEX = /^def\s+(\w+)\s*\(/;
const CLASS_REGEX = /^class\s+(\w+)(\(.*\))?:/;

interface LineInfo {
  line: number;
  indent: number;
  content: string;
}

export class PythonParser implements AbstractParser {
  private parseLines(file: string): LineInfo[] {
    return file.split('\n').map((content, index) => ({
      line: index + 1,
      indent: content.search(/\S/),
      content: content.trim()
    })).filter(line => line.content !== '');
  }

  findEnclosingContext(
    file: string,
    lineStart: number,
    lineEnd: number
  ): EnclosingContext {
    const lines = this.parseLines(file);
    let largestContext: any = null;
    let largestSize = 0;

    // Track nested contexts
    const contexts: any[] = [];

    lines.forEach((lineInfo, index) => {
      // Check for function definition
      const functionMatch = lineInfo.content.match(FUNCTION_REGEX);
      if (functionMatch) {
        const contextStart = lineInfo.line;
        
        // Find the end of the function block
        let contextEnd = contextStart;
        for (let j = index + 1; j < lines.length; j++) {
          if (lines[j].indent <= lineInfo.indent) break;
          contextEnd = lines[j].line;
        }

        // Check if this function contains the target line range
        if (contextStart <= lineStart && contextEnd >= lineEnd) {
          const size = contextEnd - contextStart;
          if (size > largestSize) {
            largestSize = size;
            largestContext = {
              type: 'function',
              name: functionMatch[1],
              start: contextStart,
              end: contextEnd
            };
          }
        }
      }

      // Check for class definition
      const classMatch = lineInfo.content.match(CLASS_REGEX);
      if (classMatch) {
        const contextStart = lineInfo.line;
        
        // Find the end of the class block
        let contextEnd = contextStart;
        for (let j = index + 1; j < lines.length; j++) {
          if (lines[j].indent <= lineInfo.indent) break;
          contextEnd = lines[j].line;
        }

        // Check if this class contains the target line range
        if (contextStart <= lineStart && contextEnd >= lineEnd) {
          const size = contextEnd - contextStart;
          if (size > largestSize) {
            largestSize = size;
            largestContext = {
              type: 'class',
              name: classMatch[1],
              start: contextStart,
              end: contextEnd
            };
          }
        }
      }
    });

    return {
      enclosingContext: largestContext
    };
  }

  dryRun(file: string): { valid: boolean; error: string } {
    try {
      // Simple syntax check
      const lines = file.split('\n');
      
      // Check for basic syntax errors
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check for unclosed parentheses, brackets, etc.
        const openParens = (line.match(/\(/g) || []).length;
        const closeParens = (line.match(/\)/g) || []).length;
        const openBrackets = (line.match(/\[/g) || []).length;
        const closeBrackets = (line.match(/\]/g) || []).length;
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;

        if (openParens !== closeParens || 
            openBrackets !== closeBrackets || 
            openBraces !== closeBraces) {
          return {
            valid: false,
            error: `Syntax error: Unbalanced brackets/parentheses at line ${i + 1}`
          };
        }

        // Check for invalid syntax
        if (line.endsWith('\\') && !line.endsWith('\\\\')) {
          return {
            valid: false,
            error: `Syntax error: Incomplete line at line ${i + 1}`
          };
        }
      }

      return {
        valid: true,
        error: ""
      };
    } catch (exc) {
      return {
        valid: false,
        error: exc instanceof Error ? exc.message : String(exc)
      };
    }
  }
}
