import { useState, useEffect } from "react";
import "./App.css";

export default function App() {
  const [n, setN] = useState(8);
  const [solutions, setSolutions] = useState([]);
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(false);
  const [mode, setMode] = useState("");

  // 🎯 Render Board
  const renderBoard = (state) => {
    return (
      <div
        className={`board ${solutions.length === 0 ? "empty" : ""}`}
        style={{
          gridTemplateColumns: `repeat(${state.length}, 1fr)`,
          gridTemplateRows: `repeat(${state.length}, 1fr)`,
          "--n": state.length
        }}
      >
        {state.map((_, col) =>
          state.map((__, row) => {
            const isQueen = state[col] === row;

            return (
              <div
                key={`${row}-${col}`}
                className={`cell ${(row + col) % 2 ? "black" : "white"}`}
              >
                {isQueen && <span className="queen">♛</span>}
              </div>
            );
          })
        )}
      </div>
    );
  };

  // 🔁 Auto play
  useEffect(() => {
    if (!auto || solutions.length === 0) return;

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % solutions.length);
    }, 1200);

    return () => clearInterval(interval);
  }, [auto, solutions]);

  // ⚠️ Conflicts
  const getConflicts = (state) => {
    let c = 0;
    for (let i = 0; i < state.length; i++) {
      for (let j = i + 1; j < state.length; j++) {
        if (
          state[i] === state[j] ||
          Math.abs(state[i] - state[j]) === Math.abs(i - j)
        ) c++;
      }
    }
    return c;
  };

  // 🧗 Hill Climbing
  const hillClimb = (n) => {
    let current = Array.from({ length: n }, () =>
      Math.floor(Math.random() * n)
    );

    while (true) {
      let cost = getConflicts(current);
      if (cost === 0) return current;

      let best = current;
      let bestCost = cost;

      for (let col = 0; col < n; col++) {
        for (let row = 0; row < n; row++) {
          let newState = [...current];
          newState[col] = row;

          let newCost = getConflicts(newState);
          if (newCost < bestCost) {
            best = newState;
            bestCost = newCost;
          }
        }
      }

      if (bestCost >= cost) return null;
      current = best;
    }
  };

  // 🎯 ONE SOLUTION
  const solveOne = () => {
    let sol;
    while (!sol) sol = hillClimb(n);

    setSolutions([sol]);
    setIndex(0);
    setMode("one");
    setAuto(false);
  };

  // 🔍 ALL SOLUTIONS (WITH UNIQUE FOR N>12)
  const solveAll = () => {
    const N = n;
    let result = [];
    let uniqueSet = new Set();

    function isSafe(state, row, col) {
      for (let i = 0; i < col; i++) {
        if (
          state[i] === row ||
          Math.abs(state[i] - row) === Math.abs(i - col)
        ) return false;
      }
      return true;
    }

    // 🔄 Mirror
    function mirror(state) {
      return state.map(r => N - 1 - r);
    }

    // 🔁 Canonical form
    function getCanonical(state) {
      let variants = [];
      variants.push(state.join(","));
      variants.push(mirror(state).join(","));
      return variants.sort()[0];
    }

    function backtrack(col, state) {
      if (col === N) {
        if (N > 12) {
          let key = getCanonical(state);
          if (!uniqueSet.has(key)) {
            uniqueSet.add(key);
            result.push([...state]);
          }
        } else {
          result.push([...state]);
        }
        return;
      }

      for (let row = 0; row < N; row++) {
        if (isSafe(state, row, col)) {
          state[col] = row;
          backtrack(col + 1, state);
        }
      }
    }

    backtrack(0, Array(N).fill(-1));

    setSolutions(result);
    setIndex(0);
    setMode("all");
    setAuto(false);
  };

  const next = () =>
    setIndex((i) => (i + 1) % solutions.length);

  const prev = () =>
    setIndex((i) => (i - 1 + solutions.length) % solutions.length);

  return (
    <div className="container">
      <h1>N-Queens Solver</h1>

      {/* INPUT FIXED */}
      <input
        type="number"
        placeholder="Enter N (e.g. 8)"
        onChange={(e) => {
          const val = parseInt(e.target.value);
          if (!isNaN(val)) setN(val);
        }}
      />

      <div className="top-buttons">
        <button onClick={solveOne}>One Solution</button>
        <button onClick={solveAll}>All Solutions</button>
      </div>

      {/* AUTO ABOVE */}
      {mode === "all" && (
        <div className="top-buttons">
          <button onClick={() => setAuto(true)}>Auto ▶</button>
          <button onClick={() => setAuto(false)}>Stop ■</button>
        </div>
      )}

      <p>{solutions.length > 0 && `Solutions: ${solutions.length}`}</p>

      {/* BOARD */}
      {solutions.length > 0
        ? renderBoard(solutions[index])
        : renderBoard(Array(n).fill(-1))}

      {/* NAV BELOW */}
      {mode === "all" && (
        <div className="nav-buttons">
          <button onClick={prev}>← Prev</button>
          <button onClick={next}>Next →</button>
        </div>
      )}
    </div>
  );
}