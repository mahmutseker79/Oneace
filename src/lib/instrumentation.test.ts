/**
 * P3-5 (audit v1.0 §10.4) — contract tests for the telemetry facade.
 *
 * These tests are the shim's guardrail. Once product code starts
 * calling `track()` at scale, a regression here (e.g. removing
 * the try/catch on a sink) would silently break every feature
 * that depends on analytics.
 *
 * Invariants we pin:
 *
 *   1. track() is safe on server / SSR (no window, no throw).
 *   2. track() fans out to every registered sink.
 *   3. A throwing sink does not prevent OTHER sinks from
 *      receiving the event.
 *   4. track() never re-throws, period.
 *   5. __clearTestSinks() actually clears.
 *   6. Props object is forwarded verbatim (not cloned, not
 *      coerced). This is important because some sinks identify
 *      duplicate events by reference equality of props.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { __clearTestSinks, __registerTestSink, track } from "./instrumentation";

afterEach(() => {
  __clearTestSinks();
});

describe("track() — server / SSR safety (§10.4)", () => {
  it("does not throw when called with no sinks registered", () => {
    expect(() => track("noop_event")).not.toThrow();
  });

  it("does not throw when called with props", () => {
    expect(() => track("noop_event_with_props", { foo: 1, bar: "x" })).not.toThrow();
  });

  it("does not throw even if props are undefined (optional arg)", () => {
    expect(() => track("noop_event_no_props")).not.toThrow();
  });
});

describe("track() — fan-out to sinks (§10.4)", () => {
  it("dispatches to a single registered sink", () => {
    const sink = vi.fn();
    __registerTestSink(sink);
    track("user_action", { id: "abc" });
    expect(sink).toHaveBeenCalledTimes(1);
    expect(sink).toHaveBeenCalledWith("user_action", { id: "abc" });
  });

  it("dispatches to every registered sink in registration order", () => {
    const order: string[] = [];
    const a = vi.fn(() => {
      order.push("a");
    });
    const b = vi.fn(() => {
      order.push("b");
    });
    __registerTestSink(a);
    __registerTestSink(b);
    track("ordered_event");
    expect(order).toEqual(["a", "b"]);
  });

  it("forwards the props object by reference (no clone, no coerce)", () => {
    const sink = vi.fn();
    __registerTestSink(sink);
    const props = { nested: { count: 1 } };
    track("ref_event", props);
    const received = sink.mock.calls[0][1];
    expect(received).toBe(props);
  });
});

describe("track() — sink isolation (§10.4)", () => {
  it("swallows a throwing sink without aborting the fan-out", () => {
    const bad = vi.fn(() => {
      throw new Error("sink-exploded");
    });
    const good = vi.fn();
    __registerTestSink(bad);
    __registerTestSink(good);

    expect(() => track("mixed_event")).not.toThrow();
    expect(bad).toHaveBeenCalledTimes(1);
    expect(good).toHaveBeenCalledTimes(1);
  });

  it("never re-throws even if every sink throws", () => {
    __registerTestSink(() => {
      throw new Error("first");
    });
    __registerTestSink(() => {
      throw new Error("second");
    });
    expect(() => track("all_bad")).not.toThrow();
  });
});

describe("test-sink registry hygiene (§10.4)", () => {
  it("returned dispose fn removes only that sink", () => {
    const a = vi.fn();
    const b = vi.fn();
    const disposeA = __registerTestSink(a);
    __registerTestSink(b);

    disposeA();
    track("after_dispose");
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("__clearTestSinks drops every registered sink", () => {
    const a = vi.fn();
    const b = vi.fn();
    __registerTestSink(a);
    __registerTestSink(b);
    __clearTestSinks();

    track("after_clear");
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });
});

describe("module shape (§10.4)", () => {
  it("exports the public API and internal test hooks", async () => {
    const mod = await import("./instrumentation");
    expect(typeof mod.track).toBe("function");
    expect(typeof mod.__registerTestSink).toBe("function");
    expect(typeof mod.__clearTestSinks).toBe("function");
  });
});
