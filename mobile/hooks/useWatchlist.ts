import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WatchlistItem } from "../data/mockData";

const WATCHLIST_KEY = "@watchlist";

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      const data = await AsyncStorage.getItem(WATCHLIST_KEY);
      if (data) {
        setWatchlist(JSON.parse(data));
      }
    } catch (error) {
      console.error("Failed to load watchlist:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveWatchlist = async (items: WatchlistItem[]) => {
    try {
      await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(items));
      setWatchlist(items);
    } catch (error) {
      console.error("Failed to save watchlist:", error);
    }
  };

  const addToWatchlist = useCallback((stock: WatchlistItem) => {
    const newWatchlist = [...watchlist];
    if (!newWatchlist.some((s) => s.symbol === stock.symbol)) {
      newWatchlist.push({
        ...stock,
        shares: stock.shares || 0,
        purchasePrice: stock.purchasePrice || 0,
      });
      saveWatchlist(newWatchlist);
    }
  }, [watchlist]);

  const updateWatchlistItem = useCallback((symbol: string, updates: Partial<WatchlistItem>) => {
    const newWatchlist = watchlist.map((item) =>
      item.symbol === symbol ? { ...item, ...updates } : item
    );
    saveWatchlist(newWatchlist);
  }, [watchlist]);

  const removeFromWatchlist = useCallback((symbol: string) => {
    const newWatchlist = watchlist.filter((s) => s.symbol !== symbol);
    saveWatchlist(newWatchlist);
  }, [watchlist]);

  const isInWatchlist = useCallback((symbol: string) => {
    return watchlist.some((s) => s.symbol === symbol);
  }, [watchlist]);

  const clearWatchlist = useCallback(() => {
    saveWatchlist([]);
  }, []);

  return {
    watchlist,
    loading,
    addToWatchlist,
    updateWatchlistItem,
    removeFromWatchlist,
    isInWatchlist,
    clearWatchlist,
    refreshWatchlist: loadWatchlist,
  };
}

