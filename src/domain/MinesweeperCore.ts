export type CellState = 'hidden' | 'revealed' | 'flagged' | 'question';

export interface Cell {
  x: number;
  y: number;
  isMine: boolean;
  neighborMines: number;
  state: CellState;
  exploded?: boolean;
  wrongFlag?: boolean;
}

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost';

export interface DifficultyConfig {
  name: string;
  rows: number;
  cols: number;
  mines: number;
}

export const DIFFICULTIES: Record<string, DifficultyConfig> = {
  beginner: { name: '初級', rows: 9, cols: 9, mines: 10 },
  intermediate: { name: '中級', rows: 12, cols: 12, mines: 20 },
  expert: { name: '專家', rows: 16, cols: 16, mines: 40 }
};

export class MinesweeperGame {
  public rows: number;
  public cols: number;
  public totalMines: number;
  public grid: Cell[][] = [];
  public status: GameStatus = 'idle';
  public flagsCount: number = 0;
  public revealedCount: number = 0;
  public startTime: number = 0;
  public endTime: number = 0;
  private firstClick: boolean = true;

  constructor(difficulty: DifficultyConfig = DIFFICULTIES.beginner) {
    this.rows = difficulty.rows;
    this.cols = difficulty.cols;
    this.totalMines = difficulty.mines;
    this.reset();
  }

  public reset(difficulty?: DifficultyConfig): void {
    if (difficulty) {
      this.rows = difficulty.rows;
      this.cols = difficulty.cols;
      this.totalMines = difficulty.mines;
    }
    this.grid = [];
    this.status = 'idle';
    this.flagsCount = 0;
    this.revealedCount = 0;
    this.startTime = 0;
    this.endTime = 0;
    this.firstClick = true;

    for (let r = 0; r < this.rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < this.cols; c++) {
        row.push({
          x: c,
          y: r,
          isMine: false,
          neighborMines: 0,
          state: 'hidden'
        });
      }
      this.grid.push(row);
    }
  }

  public get remainingMines(): number {
    return this.totalMines - this.flagsCount;
  }

  public get elapsedTime(): number {
    if (this.status === 'idle') return 0;
    if (this.status === 'playing') {
      return Math.floor((Date.now() - this.startTime) / 1000);
    }
    return Math.floor((this.endTime - this.startTime) / 1000);
  }

  public getCell(r: number, c: number): Cell | null {
    if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
    return this.grid[r][c];
  }

  private generateMines(safeR: number, safeC: number): void {
    let placed = 0;
    const maxSafeDist = 1; // 首擊九宮格內不生雷

    while (placed < this.totalMines) {
      const r = Math.floor(Math.random() * this.rows);
      const c = Math.floor(Math.random() * this.cols);

      const inSafeZone = Math.abs(r - safeR) <= maxSafeDist && Math.abs(c - safeC) <= maxSafeDist;
      if (inSafeZone) continue;

      if (!this.grid[r][c].isMine) {
        this.grid[r][c].isMine = true;
        placed++;
      }
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        if (!this.grid[r][c].isMine) {
          this.grid[r][c].neighborMines = this.countNeighborMines(r, c);
        }
      }
    }
  }

  public countNeighborMines(r: number, c: number): number {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const neighbor = this.getCell(r + dr, c + dc);
        if (neighbor && neighbor.isMine) count++;
      }
    }
    return count;
  }

  public reveal(r: number, c: number): { changed: Cell[]; hitMine: boolean } {
    const cell = this.getCell(r, c);
    if (!cell || this.status === 'won' || this.status === 'lost') {
      return { changed: [], hitMine: false };
    }
    if (cell.state === 'flagged' || cell.state === 'revealed') {
      return { changed: [], hitMine: false };
    }

    if (this.firstClick) {
      this.firstClick = false;
      this.status = 'playing';
      this.startTime = Date.now();
      this.generateMines(r, c);
    }

    if (cell.isMine) {
      cell.exploded = true;
      cell.state = 'revealed';
      this.status = 'lost';
      this.endTime = Date.now();
      this.revealAllMinesOnLoss();
      return { changed: [cell], hitMine: true };
    }

    const changed: Cell[] = [];
    const queue: Cell[] = [cell];
    cell.state = 'revealed';
    this.revealedCount++;
    changed.push(cell);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr.neighborMines === 0) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const neighbor = this.getCell(curr.y + dr, curr.x + dc);
            if (neighbor && neighbor.state === 'hidden') {
              neighbor.state = 'revealed';
              this.revealedCount++;
              changed.push(neighbor);
              if (neighbor.neighborMines === 0) {
                queue.push(neighbor);
              }
            }
          }
        }
      }
    }

    const safeTotal = this.rows * this.cols - this.totalMines;
    if (this.revealedCount >= safeTotal) {
      this.status = 'won';
      this.endTime = Date.now();
      this.autoFlagAllMinesOnWin();
    }

    return { changed, hitMine: false };
  }

  public toggleFlag(r: number, c: number): Cell | null {
    const cell = this.getCell(r, c);
    if (!cell || this.status === 'won' || this.status === 'lost') return null;
    if (cell.state === 'revealed') return null;

    if (this.status === 'idle') {
      this.status = 'playing';
      this.startTime = Date.now();
    }

    if (cell.state === 'hidden') {
      cell.state = 'flagged';
      this.flagsCount++;
    } else if (cell.state === 'flagged') {
      cell.state = 'question';
      this.flagsCount--;
    } else if (cell.state === 'question') {
      cell.state = 'hidden';
    }

    return cell;
  }

  public chord(r: number, c: number): { changed: Cell[]; hitMine: boolean } {
    const cell = this.getCell(r, c);
    if (!cell || cell.state !== 'revealed' || cell.neighborMines === 0) {
      return { changed: [], hitMine: false };
    }

    let flagCount = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const neighbor = this.getCell(r + dr, c + dc);
        if (neighbor && neighbor.state === 'flagged') flagCount++;
      }
    }

    if (flagCount === cell.neighborMines) {
      const allChanged: Cell[] = [];
      let hit = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          const neighbor = this.getCell(nr, nc);
          if (neighbor && neighbor.state === 'hidden') {
            const res = this.reveal(nr, nc);
            allChanged.push(...res.changed);
            if (res.hitMine) {
              hit = true;
              break;
            }
          }
        }
        if (hit) break;
      }
      return { changed: allChanged, hitMine: hit };
    }

    return { changed: [], hitMine: false };
  }

  private revealAllMinesOnLoss(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.isMine && cell.state !== 'flagged') {
          cell.state = 'revealed';
        } else if (!cell.isMine && cell.state === 'flagged') {
          cell.wrongFlag = true;
        }
      }
    }
  }

  private autoFlagAllMinesOnWin(): void {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cell = this.grid[r][c];
        if (cell.isMine && cell.state !== 'flagged') {
          cell.state = 'flagged';
          this.flagsCount++;
        }
      }
    }
  }
}
