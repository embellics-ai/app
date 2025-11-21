import { vi } from 'vitest';

// Mock React Router
export const mockNavigate = vi.fn();
export const mockUseLocation = vi.fn(() => ({
  pathname: '/',
  search: '',
  hash: '',
  state: null,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: mockUseLocation,
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock Tanstack Query
export const mockUseQuery = vi.fn();
export const mockUseMutation = vi.fn();
export const mockQueryClient = {
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
  getQueryData: vi.fn(),
};

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: mockUseQuery,
    useMutation: mockUseMutation,
    useQueryClient: () => mockQueryClient,
  };
});

// Reset all mocks
export const resetAllMocks = () => {
  mockNavigate.mockReset();
  mockUseLocation.mockReset();
  mockUseQuery.mockReset();
  mockUseMutation.mockReset();
  mockQueryClient.invalidateQueries.mockReset();
  mockQueryClient.setQueryData.mockReset();
  mockQueryClient.getQueryData.mockReset();
};
