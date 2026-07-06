interface Tab {
  id: number;
  cart: { product: { id: number }; quantity: number; discount: number }[];
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId: number;
  onTabChange: (tabId: number) => void;
}

export function TabBar({ tabs, activeTabId, onTabChange }: TabBarProps) {
  if (tabs.length <= 1) return null;

  return (
    <div className="flex gap-1">
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
            tab.id === activeTabId
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          {i + 1}{tab.cart.length > 0 ? ` (${tab.cart.length})` : ""}
        </button>
      ))}
    </div>
  );
}
