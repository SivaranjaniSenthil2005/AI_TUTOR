/**
 * AI Tutor - Ridge Regression
 * Clean, lightweight Ridge Regression in TypeScript with feature standardization and linear system solver.
 */

export interface StandardizationParams {
  means: number[];
  stds: number[];
}

export interface RidgeModel {
  weights: number[][]; // Shape: (numFeatures + 1, numTargets), last row is intercept
  standardization: StandardizationParams;
  lambda: number;
}

/**
 * Solves the linear system A * X = B for X using Gaussian elimination with partial pivoting.
 * A is (n x n), B is (n x m), returns X of shape (n x m).
 */
export function solveLinearSystem(A: number[][], B: number[][]): number[][] {
  const n = A.length;
  const m = B[0].length;

  // Create augmented matrix [A | B]
  const M: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    M[i] = new Array(n + m);
    for (let j = 0; j < n; j++) {
      M[i][j] = A[i][j];
    }
    for (let j = 0; j < m; j++) {
      M[i][n + j] = B[i][j];
    }
  }

  // Forward elimination with partial pivoting
  for (let col = 0; col < n; col++) {
    // Find pivot row
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      const val = Math.abs(M[row][col]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = row;
      }
    }

    // Swap pivot row if needed
    if (maxRow !== col) {
      const temp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = temp;
    }

    const pivot = M[col][col];
    if (Math.abs(pivot) < 1e-12) {
      // Near-singular matrix: add small jitter along diagonal for numerical stability
      M[col][col] += 1e-6;
    }

    const currentPivot = M[col][col];

    // Normalize pivot row
    for (let j = col; j < n + m; j++) {
      M[col][j] /= currentPivot;
    }

    // Eliminate other rows
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = M[row][col];
        if (Math.abs(factor) > 1e-14) {
          for (let j = col; j < n + m; j++) {
            M[row][j] -= factor * M[col][j];
          }
        }
      }
    }
  }

  // Extract solution X
  const X: number[][] = new Array(n);
  for (let i = 0; i < n; i++) {
    X[i] = new Array(m);
    for (let j = 0; j < m; j++) {
      X[i][j] = M[i][n + j];
    }
  }

  return X;
}

/**
 * Computes mean and standard deviation for each column in X.
 */
export function computeStandardization(X: number[][]): StandardizationParams {
  const numSamples = X.length;
  const numFeatures = X[0].length;
  const means: number[] = new Array(numFeatures).fill(0);
  const stds: number[] = new Array(numFeatures).fill(0);

  for (let j = 0; j < numFeatures; j++) {
    let sum = 0;
    for (let i = 0; i < numSamples; i++) {
      sum += X[i][j];
    }
    means[j] = sum / numSamples;

    let varSum = 0;
    for (let i = 0; i < numSamples; i++) {
      const diff = X[i][j] - means[j];
      varSum += diff * diff;
    }
    const std = Math.sqrt(varSum / Math.max(numSamples - 1, 1));
    // Avoid division by zero for constant features
    stds[j] = std < 1e-7 ? 1.0 : std;
  }

  return { means, stds };
}

/**
 * Standardizes a feature matrix using precomputed means and standard deviations.
 */
export function applyStandardization(
  X: number[][],
  params: StandardizationParams
): number[][] {
  const numSamples = X.length;
  const numFeatures = X[0].length;
  const X_std: number[][] = new Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    X_std[i] = new Array(numFeatures);
    for (let j = 0; j < numFeatures; j++) {
      X_std[i][j] = (X[i][j] - params.means[j]) / params.stds[j];
    }
  }

  return X_std;
}

/**
 * Fits a Ridge Regression model mapping X -> Y with L2 regularization parameter lambda.
 * X: (N x D), Y: (N x K)
 */
export function fitRidgeRegression(
  X: number[][],
  Y: number[][],
  lambda: number = 1e-2
): RidgeModel {
  const N = X.length;
  if (N === 0) {
    throw new Error("Cannot fit Ridge regression with 0 samples.");
  }
  const D = X[0].length;
  const K = Y[0].length;

  // 1. Standardize features
  const standardization = computeStandardization(X);
  const X_std = applyStandardization(X, standardization);

  // 2. Build augmented matrix X_aug with intercept column of 1s (N x (D + 1))
  const X_aug: number[][] = new Array(N);
  for (let i = 0; i < N; i++) {
    X_aug[i] = new Array(D + 1);
    for (let j = 0; j < D; j++) {
      X_aug[i][j] = X_std[i][j];
    }
    X_aug[i][D] = 1.0; // Intercept
  }

  // 3. Compute A = X_aug^T * X_aug + lambda * I (regularization does not penalize intercept)
  const A: number[][] = new Array(D + 1);
  for (let i = 0; i <= D; i++) {
    A[i] = new Array(D + 1).fill(0);
    for (let j = 0; j <= D; j++) {
      let sum = 0;
      for (let k = 0; k < N; k++) {
        sum += X_aug[k][i] * X_aug[k][j];
      }
      A[i][j] = sum;
    }
    // Add lambda to diagonal for feature weights, not intercept
    if (i < D) {
      A[i][i] += lambda;
    }
  }

  // 4. Compute B = X_aug^T * Y ((D + 1) x K)
  const B: number[][] = new Array(D + 1);
  for (let i = 0; i <= D; i++) {
    B[i] = new Array(K).fill(0);
    for (let j = 0; j < K; j++) {
      let sum = 0;
      for (let k = 0; k < N; k++) {
        sum += X_aug[k][i] * Y[k][j];
      }
      B[i][j] = sum;
    }
  }

  // 5. Solve for weights W = A^-1 * B
  const weights = solveLinearSystem(A, B);

  return {
    weights,
    standardization,
    lambda,
  };
}

/**
 * Predicts Y given input features X and a fitted RidgeModel.
 * X: (N x D), returns Y_pred: (N x K)
 */
export function predictRidgeRegression(
  X: number[][],
  model: RidgeModel
): number[][] {
  const N = X.length;
  const D = X[0].length;
  const K = model.weights[0].length;

  const X_std = applyStandardization(X, model.standardization);
  const Y_pred: number[][] = new Array(N);

  for (let i = 0; i < N; i++) {
    Y_pred[i] = new Array(K);
    for (let k = 0; k < K; k++) {
      let sum = model.weights[D][k]; // Intercept
      for (let j = 0; j < D; j++) {
        sum += X_std[i][j] * model.weights[j][k];
      }
      Y_pred[i][k] = sum;
    }
  }

  return Y_pred;
}
