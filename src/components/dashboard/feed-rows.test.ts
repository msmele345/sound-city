import { groupFeedRows } from "./feed-rows";

describe("groupFeedRows", () => {
  it("assigns each row its position while grouping consecutive labels in one pass", () => {
    const events = [
      { id: "late", day: "Tonight" },
      { id: "later", day: "Tonight" },
      { id: "next", day: "Tomorrow" },
    ];

    expect(groupFeedRows(events, (event) => event.day)).toEqual([
      {
        label: "Tonight",
        rows: [
          { item: events[0], index: 0 },
          { item: events[1], index: 1 },
        ],
      },
      {
        label: "Tomorrow",
        rows: [{ item: events[2], index: 2 }],
      },
    ]);
  });
});
