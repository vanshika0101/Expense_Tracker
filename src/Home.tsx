import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import NetInfo from '@react-native-community/netinfo';

const { width } = Dimensions.get('window');

interface Expense {
  id: string;
  amount: string;
  category: string;
  date: string; // DD/MM/YYYY
  note?: string;
  isSynced?: boolean;
}

const getStartOfWeek = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(now.setDate(diff));
};

const isSameWeek = (dateStr: string) => {
  const parts = dateStr.split('/');
  const date = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  const startOfWeek = getStartOfWeek();
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  return date >= startOfWeek && date <= endOfWeek;
};

const isSameMonth = (dateStr: string) => {
  const now = new Date();
  const parts = dateStr.split('/');
  const date = new Date(+parts[2], +parts[1] - 1, +parts[0]);
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
};

const Home = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState<'Monthly' | 'Weekly'>('Monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check network status
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      // Step 1: Get data from AsyncStorage
      const localData = await AsyncStorage.getItem('offline_expenses');
      const localExpenses: Expense[] = localData ? JSON.parse(localData) : [];
      console.log('Local expenses:', localExpenses);

      // Step 2: If online, get data from Firestore
      let firestoreExpenses: Expense[] = [];
      if (isOnline) {
        const currentUser = auth().currentUser;
        if (currentUser && currentUser.uid) {
          const snapshot = await firestore()
            .collection('users')
            .doc(currentUser.uid)
            .collection('expenses')
            .get();

          firestoreExpenses = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            isSynced: true
          })) as Expense[];
          console.log('Firestore expenses:', firestoreExpenses);
        }
      }

      // Step 3: Combine and deduplicate expenses
      const allExpenses = [...localExpenses];
      
      // Add Firestore expenses that don't exist in local storage
      firestoreExpenses.forEach(firestoreExpense => {
        const exists = allExpenses.some(localExpense => localExpense.id === firestoreExpense.id);
        if (!exists) {
          allExpenses.push(firestoreExpense);
        }
      });

      // Sort by date (newest first)
      allExpenses.sort((a, b) => {
        const dateA = new Date(a.date.split('/').reverse().join('/'));
        const dateB = new Date(b.date.split('/').reverse().join('/'));
        return dateB.getTime() - dateA.getTime();
      });

      console.log('Combined expenses:', allExpenses);
      setExpenses(allExpenses);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchExpenses();
    }, [isOnline])
  );

  const getFilteredExpenses = () => {
    return expenses.filter((e) =>
      filter === 'Monthly' ? isSameMonth(e.date) : isSameWeek(e.date)
    );
  };

  const renderChart = () => {
    const filteredExpenses = getFilteredExpenses();

    if (!filteredExpenses || filteredExpenses.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No {filter.toLowerCase()} expenses</Text>
        </View>
      );
    }

    const total = filteredExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    const categories = [...new Set(filteredExpenses.map(e => e.category))];
    const colors = ['#FFD700', '#00CED1', '#FF4500', '#32CD32', '#9932CC', '#DC143C', '#FF69B4', '#1E90FF'];

    const chartData = categories.map((cat, index) => {
      const value = filteredExpenses
        .filter(e => e.category === cat)
        .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

      return {
        name: cat,
        population: value,
        color: colors[index % colors.length],
        legendFontColor: '#333',
        legendFontSize: 12,
      };
    });

    return (
      <View style={styles.container}>
        <Text style={{ color: 'black', fontSize: 24, margin: 20 }}>EXPENSE TRACKER</Text>
        <View style={styles.chartContainer}>
          <PieChart
            data={chartData}
            width={width - 32}
            height={220}
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 2,
              color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
              style: {
                borderRadius: 16,
              },
            }}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </View>
        <View style={styles.legendContainer}>
          {chartData.map((item, index) => {
            const percentage = ((item.population / total) * 100).toFixed(1);
            return (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: item.color }]} />
                <Text style={styles.legendText}>
                  {item.name}: ₹{item.population.toFixed(2)} ({percentage}%)
                </Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.totalText}>Total: ₹{total.toFixed(2)}</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00CED1" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>You are offline. Showing local data only.</Text>
        </View>
      )}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'Weekly' && styles.selectedFilter]}
          onPress={() => setFilter('Weekly')}
        >
          <Text style={styles.filterText}>This Week</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'Monthly' && styles.selectedFilter]}
          onPress={() => setFilter('Monthly')}
        >
          <Text style={styles.filterText}>This Month</Text>
        </TouchableOpacity>
      </View>
      {renderChart()}
    </ScrollView>
  );
};

// same styles as you had before
const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    padding: 16,
    alignItems: 'center',
  },
  chartContainer: {
    marginVertical: 20,
    borderRadius: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  legendContainer: {
    width: '100%',
    padding: 16,
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    marginTop: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#333',
  },
  totalText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    color: '#333',
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 10,
  },
  filterButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#eee',
    borderRadius: 20,
  },
  selectedFilter: {
    backgroundColor: '#00CED1',
  },
  filterText: {
    fontSize: 14,
    color: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  offlineBanner: {
    backgroundColor: '#ff9800',
    padding: 10,
    marginBottom: 10,
    borderRadius: 5,
  },
  offlineText: {
    color: '#fff',
    textAlign: 'center',
  },
});

export default Home;
