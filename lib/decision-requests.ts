type DecisionRequest = { automatic: boolean; controller: AbortController };

// A direction from the presenter can replace an automatic request, never the reverse.
export function createDecisionRequests() {
  let active: DecisionRequest | null = null;
  return {
    get busy() { return active !== null; },
    begin(automatic: boolean) {
      if (active && (automatic || !active.automatic)) return null;
      active?.controller.abort('superseded');
      active = { automatic, controller: new AbortController() };
      return active;
    },
    isCurrent(request: DecisionRequest) { return active === request && !request.controller.signal.aborted; },
    owns(request: DecisionRequest) { return active === request; },
    finish(request: DecisionRequest) {
      if (active !== request) return false;
      active = null;
      return true;
    },
    cancel() { active?.controller.abort('cancelled'); active = null; },
  };
}
