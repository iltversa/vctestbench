import { create } from 'zustand';
import { FlowNode } from '@/components/TestFlowBuilder';
import { TestActionDefinition } from '@/services/get-test-actions';

export interface TestFlowState {
  // Test metadata
  testId?: string;
  testTitle: string;
  testDescription: string;
  
  // Flow and actions
  nodes: FlowNode[];
  actions: TestActionDefinition[];
  
  // UI state
  editingAction: TestActionDefinition | null;
  
  // Actions
  setTestTitle: (title: string) => void;
  setTestDescription: (description: string) => void;
  setNodes: (nodes: FlowNode[]) => void;
  setActions: (actions: TestActionDefinition[]) => void;
  setEditingAction: (action: TestActionDefinition | null) => void;
  
  // Initialize from saved test
  initializeFromTest: (test: { id?: string; title: string; description?: string; flow?: FlowNode[]; actions?: TestActionDefinition[] }) => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  testId: undefined,
  testTitle: '',
  testDescription: '',
  nodes: [],
  actions: [],
  editingAction: null,
};

export const useTestFlowStore = create<TestFlowState>((set) => ({
  ...initialState,
  
  setTestTitle: (title) => set({ testTitle: title }),
  setTestDescription: (description) => set({ testDescription: description }),
  setNodes: (nodes) => set({ nodes }),
  setActions: (actions) => set({ actions }),
  setEditingAction: (action) => set({ editingAction: action }),
  
  initializeFromTest: (test) => set({
    testId: test.id,
    testTitle: test.title ?? '',
    testDescription: test.description ?? '',
    nodes: test.flow && test.flow.length > 0 ? test.flow : [],
    actions: test.actions && test.actions.length > 0 ? test.actions : [],
  }),
  
  reset: () => set(initialState),
}));
