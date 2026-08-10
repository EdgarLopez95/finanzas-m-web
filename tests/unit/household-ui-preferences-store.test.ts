import test, { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { useHouseholdUiPreferencesStore } from "@/stores/household-ui-preferences-store";

describe("HouseholdUiPreferencesStore", () => {
  let getItemMock: any;
  let setItemMock: any;
  let removeItemMock: any;

  beforeEach(() => {
    getItemMock = mock.fn();
    setItemMock = mock.fn();
    removeItemMock = mock.fn();

    global.window = {
      localStorage: {
        getItem: getItemMock,
        setItem: setItemMock,
        removeItem: removeItemMock,
      },
    } as any;

    // Resetear el store antes de cada prueba
    useHouseholdUiPreferencesStore.setState({
      hydrated: false,
      isEditingHouseholdBoard: false,
      householdBoardOrder: ["categories", "movements", "contributions"],
      householdHiddenCards: [],
    });
  });

  afterEach(() => {
    mock.restoreAll();
    // @ts-ignore
    delete global.window;
  });

  it("should have default state", () => {
    const state = useHouseholdUiPreferencesStore.getState();
    assert.equal(state.hydrated, false);
    assert.equal(state.isEditingHouseholdBoard, false);
    assert.deepEqual(state.householdBoardOrder, ["categories", "movements", "contributions"]);
    assert.deepEqual(state.householdHiddenCards, []);
  });

  it("should hydrate from localStorage", () => {
    const mockOrder = ["contributions", "categories", "movements"];
    const mockHidden = ["movements"];
    
    getItemMock.mock.mockImplementation((key: string) => {
      if (key === "fm-hh-board-order") return JSON.stringify(mockOrder);
      if (key === "fm-hh-board-hidden") return JSON.stringify(mockHidden);
      return null;
    });

    useHouseholdUiPreferencesStore.getState().hydrate();

    const state = useHouseholdUiPreferencesStore.getState();
    assert.equal(state.hydrated, true);
    assert.deepEqual(state.householdBoardOrder, mockOrder);
    assert.deepEqual(state.householdHiddenCards, mockHidden);
    assert.equal(getItemMock.mock.callCount(), 2);
  });

  it("should hydrate with default values if localStorage is empty", () => {
    getItemMock.mock.mockImplementation(() => null);

    useHouseholdUiPreferencesStore.getState().hydrate();

    const state = useHouseholdUiPreferencesStore.getState();
    assert.equal(state.hydrated, true);
    assert.deepEqual(state.householdBoardOrder, ["categories", "movements", "contributions"]);
    assert.deepEqual(state.householdHiddenCards, []);
  });

  it("should set editing mode", () => {
    useHouseholdUiPreferencesStore.getState().setEditingHouseholdBoard(true);
    assert.equal(useHouseholdUiPreferencesStore.getState().isEditingHouseholdBoard, true);
  });

  it("should set board order and persist to localStorage", () => {
    const newOrder = ["movements", "categories", "contributions"];
    useHouseholdUiPreferencesStore.getState().setHouseholdBoardOrder(newOrder);

    assert.deepEqual(useHouseholdUiPreferencesStore.getState().householdBoardOrder, newOrder);
    assert.equal(setItemMock.mock.calls[0].arguments[0], "fm-hh-board-order");
    assert.equal(setItemMock.mock.calls[0].arguments[1], JSON.stringify(newOrder));
  });

  it("should hide a card and persist", () => {
    useHouseholdUiPreferencesStore.getState().hideHouseholdCard("categories");

    assert.ok(useHouseholdUiPreferencesStore.getState().householdHiddenCards.includes("categories"));
    assert.equal(setItemMock.mock.calls[0].arguments[0], "fm-hh-board-hidden");
    assert.equal(setItemMock.mock.calls[0].arguments[1], JSON.stringify(["categories"]));
  });

  it("should show a card and persist", () => {
    // Initial hidden state
    useHouseholdUiPreferencesStore.setState({
      householdHiddenCards: ["categories", "movements"],
    });

    useHouseholdUiPreferencesStore.getState().showHouseholdCard("categories");

    assert.deepEqual(useHouseholdUiPreferencesStore.getState().householdHiddenCards, ["movements"]);
    assert.equal(setItemMock.mock.calls[0].arguments[0], "fm-hh-board-hidden");
    assert.equal(setItemMock.mock.calls[0].arguments[1], JSON.stringify(["movements"]));
  });

  it("should reset to default state and clear localStorage", () => {
    useHouseholdUiPreferencesStore.setState({
      householdBoardOrder: ["movements"],
      householdHiddenCards: ["categories"],
    });

    useHouseholdUiPreferencesStore.getState().resetHouseholdBoard();

    const state = useHouseholdUiPreferencesStore.getState();
    assert.deepEqual(state.householdBoardOrder, ["categories", "movements", "contributions"]);
    assert.deepEqual(state.householdHiddenCards, []);
    assert.equal(removeItemMock.mock.calls[0].arguments[0], "fm-hh-board-order");
    assert.equal(removeItemMock.mock.calls[1].arguments[0], "fm-hh-board-hidden");
  });
});
