import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import NetInfo from '@react-native-community/netinfo';

interface Expense {
  id: string;
  amount: string;
  category: string;
  date: string;
  note?: string;
  merchant?: string;
  isSynced?: boolean;
}

const History = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
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

  useEffect(() => {
    const fetchExpenses = async () => {
      setIsLoading(true);
      try {
        // Step 1: Always get data from AsyncStorage first
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
              .orderBy('date', 'desc')
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

    fetchExpenses();
  }, [isOnline]);

  const renderItem = ({ item }: { item: Expense }) => (
    <View style={styles.item}>
      <View style={styles.row}>
        <Text style={styles.date}>{item.date}</Text>
        <Text style={styles.category}>{item.category}</Text>
        <Text style={styles.amount}>₹{item.amount}</Text>
      </View>
      {item.merchant && (
        <Text style={styles.merchant}>Merchant: {item.merchant}</Text>
      )}
      {item.note && (
        <Text style={styles.note}>Note: {item.note}</Text>
      )}
      {!isOnline && !item.isSynced && (
        <Text style={styles.offlineText}>Offline - Will sync when online</Text>
      )}
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00CED1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>You are offline. Showing local data only.</Text>
        </View>
      )}
      <Text style={styles.header}>Expense History</Text>
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No expenses found.</Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: '#fff' 
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
  offlineBannerText: {
    color: '#fff',
    textAlign: 'center',
  },
  header: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    marginBottom: 20,
    color: '#000'
  },
  item: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 8,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: {
    flex: 1,
    color: '#333',
    fontWeight: 'bold',
  },
  category: {
    flex: 2,
    textAlign: 'center',
    color: '#444',
  },
  amount: {
    flex: 1,
    textAlign: 'right',
    color: '#000',
    fontWeight: 'bold',
  },
  merchant: {
    marginTop: 4,
    color: '#666',
    fontSize: 14,
  },
  note: {
    marginTop: 4,
    fontStyle: 'italic',
    color: '#888',
    fontSize: 13,
  },
  offlineText: {
    marginTop: 4,
    color: '#ff9800',
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyText: { 
    textAlign: 'center', 
    marginTop: 50,
    color: '#666'
  },
});

export default History;
