import { Observable } from "@babylonjs/core/Misc/observable";

class State {
    public neighbors: Map<number, number>;
    public onStateEnterObservable: Observable<void>;
    public onStateExitObservable: Observable<void>;

    public constructor() {
        this.neighbors = new Map<number, number>();
        this.onStateEnterObservable = new Observable<void>();
        this.onStateExitObservable = new Observable<void>();
    }
}

export class FiniteStateMachine {
    private _graph: Map<number, State>;
    private _state?: State;

    public constructor() {
        this._graph = new Map<number, State>();
    }

    public addEdge(from: number, to: number, condition: number) {
        if (!this._graph.has(from)) {
            this._graph.set(from, new State());
        }

        if (!this._graph.has(to)) {
            this._graph.set(to, new State());
        }

        this._graph.get(from)!.neighbors.set(condition, to);
    }

    public setState(state: number) {
        if (!this._graph.has(state)) {
            this._graph.set(state, new State());
        }

        this._state?.onStateExitObservable.notifyObservers();
        this._state = this._graph.get(state)!;
        this._state.onStateEnterObservable.notifyObservers();
    }

    public getStateEnterObservable(state: number): Observable<void> {
        if (!this._graph.has(state)) {
            this._graph.set(state, new State());
        }

        return this._graph.get(state)!.onStateEnterObservable;
    }

    public getStateExitObservable(state: number): Observable<void> {
        if (!this._graph.has(state)) {
            this._graph.set(state, new State());
        }

        return this._graph.get(state)!.onStateExitObservable;
    }

    public signal(condition: number) {
        if (!this._state) {
            throw new Error("Graph must be initialized to a valid state before signaling");
        }

        const nextState = this._state.neighbors.get(condition);
        if (nextState) {
            this._state.onStateExitObservable.notifyObservers();
            this._state = this._graph.get(nextState)!;
            this._state.onStateEnterObservable.notifyObservers();
        }
    }
}
