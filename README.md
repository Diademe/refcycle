# Cyclic reference detection

## Intro

This application is meant to solve circular dependencies issues. To do so, it will scan hard dependencies

*hard dependencies* -> dependencies that need to be resolved during the parse of the module (i.e. every thing imported that is in the global scope of the file):

* A reference to a class, function or variable in the global scope
* An inheritance to a class
* An initialized static variable
* a decorator and its parameters

If theses hard dependencies form a DAG, then it extracts a topological order for the loading of the modules. Otherwise, throw "cyclic graph of hard dependencies" exception.
This order can be stored in a namespace (a file containing all the import), or inside each module (the loading order is not ensured).

### Remark

Detecting which dependencies are needed to form the global scope can be reduced to the halting problem (impossible in the general case). So this library look only top level declaration. If a function is called from the global scope, its body is not analyzed.

```typescript
class A { static b: B } // global scope depends B

function AMixin() { return class { static b: B}; }
const A = AMixin(); // global scope doesn't depend on B as content of `AMixin` in not scanned
```

## Execute

Backup your files before executing this command.

    ```bash
    npm ci
    npm run build
    node ./dist/index.js <tsConfigPath> <globalNamespacePath> <format> [exclusion] [graphHardDependenciesPath]
    ```

* **tsConfigPath** (required): the full path of the `tsconfig.json` (or `tsconfig.app.json`) of the project. The file must exist
* **globalNamespacePath** (required): the full path of the file that will order the imports
* **format** (required): format imports in each file (Experimental, set it to false if unsure)
* **exclusion** (optional): format imports in each file, set to '\.(component|module)\.ts$' to exclude component and module from global namespace (you should set format to true if those file are already in the global namespace)
* **graphHardDependenciesPath** (optional): if there are some cycles in the graph of hard dependencies, this program will
generate a .gml file highlighting the strongly connected component that you must break. .gml file can be opened with
[yEd](https://www.yworks.com/products/yed).

## yEd

to display the graph :

1. select all node (ctrl+a)
2. Tools -> fit Node to Label
3. Layout -> Organic -> Preferred Edge Length: 125

## Note

* internal import **must be relative** i.e.
  * `import { Document } from "src/toto"` Not OK
  * `import { Document } from "./src/toto"` OK
* the dependencies of the target project must be installed (with `npm instal` for example).
* if you get a `[warning]`, correct the import so that it import the globalNamespace and not directly a file
