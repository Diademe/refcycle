// Importing defaults
import A1Default from "./a1";
// Import a single export from a module
import { A2 } from "./a2";
// Import an entire module's contents
import * as A3All from "./a3";
import A4Default, { A4Other } from "./a4";
//  Import an export with a more convenient alias
import { A5 as A5Alias } from "./a5";
import A6 = require("./a6");
import A7Default, * as A7All from "./a7";
// import "./a8";


const a1 = new A1Default();
const a2 = new A2();
const a3 = new A3All.A31();
const a4default = new A4Default();
const a4other = new A4Other();
const a5 = new A5Alias();
const a6 = new A6();
const a9Default = new A7Default();
const a9Other = new A7All.A7Other();
