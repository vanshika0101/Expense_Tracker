import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Alert,
    Platform,
    ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/FontAwesome';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface Category {
    id: number;
    name: string;
    color: string;
}

interface RouteParams {
    amount?: string;
}

interface Expense {
    id: string;
    amount: string;
    category: string;
    date: string;
    note: string;
    isSynced?: boolean;
}

const defaultCategories = [
    'LOAN', 'TRANSPORT', 'FOOD', 'EDUCATION',
    'HOUSEHOLD', 'HEALTH', 'GIFT', 'WORK',
];

const extractAmount = (text: string): string => {
    // Remove any whitespace and convert to lowercase
    text = text.replace(/\s+/g, '').toLowerCase();
    
    // Common patterns to look for
    const patterns = [
        /total.*?(\d+(?:\.\d{1,2})?)/,  // "Total: ₹1,234.56"
        /amount.*?(\d+(?:\.\d{1,2})?)/,  // "Amount: Rs 1,234.56"
        /rs.*?(\d+(?:\.\d{1,2})?)/,      // "Rs 1,234.56"
        /₹.*?(\d+(?:\.\d{1,2})?)/,       // "₹1,234.56"
        /(\d+(?:\.\d{1,2})?)\s*(?:rs|₹)/, // "1,234.56 Rs" or "1,234.56 ₹"
        /(\d+(?:\.\d{1,2})?)/             // Just the number
    ];

    // Try each pattern in order
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
            // Remove commas and convert to number
            const amount = parseFloat(match[1].replace(/,/g, ''));
            if (!isNaN(amount)) {
                return amount.toFixed(2);
            }
        }
    }

    // If no pattern matches, try to find the largest number
    const numbers = text.match(/\d+(?:\.\d{1,2})?/g) || [];
    if (numbers.length > 0) {
        const amounts = numbers.map(num => parseFloat(num.replace(/,/g, '')));
        const maxAmount = Math.max(...amounts);
        return maxAmount.toFixed(2);
    }

    return '';
};

const Homes = ({ route }: { route: { params?: RouteParams } }) => {
    const navigation = useNavigation();
    const { amount: passedAmount = '' } = route.params || {};
    const [amount, setAmount] = useState(passedAmount);
    const [selectedCategory, setSelectedCategory] = useState('TRANSPORT');
    const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-GB'));
    const [note, setNote] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [categories, setCategories] = useState<string[]>(defaultCategories);
    const [isLoading, setIsLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        // Check network status
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            setIsOnline(state.isConnected ?? false);
            if (state.isConnected) {
                syncOfflineData();
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const syncOfflineData = async () => {
        try {
            const offlineData = await AsyncStorage.getItem('offline_expenses');
            if (offlineData) {
                const expenses: Expense[] = JSON.parse(offlineData);
                const unsyncedExpenses = expenses.filter(expense => !expense.isSynced);
                
                if (unsyncedExpenses.length > 0) {
                    const currentUser = auth().currentUser;
                    if (currentUser && currentUser.uid) {
                        const batch = firestore().batch();
                        const expensesRef = firestore().collection('users').doc(currentUser.uid).collection('expenses');

                        for (const expense of unsyncedExpenses) {
                            const docRef = expensesRef.doc(expense.id);
                            batch.set(docRef, {
                                amount: expense.amount,
                                category: expense.category,
                                date: expense.date,
                                note: expense.note,
                                createdAt: firestore.FieldValue.serverTimestamp(),
                            });
                        }

                        await batch.commit();
                        
                        // Mark expenses as synced
                        const updatedExpenses = expenses.map(expense => ({
                            ...expense,
                            isSynced: true
                        }));
                        await AsyncStorage.setItem('offline_expenses', JSON.stringify(updatedExpenses));
                    }
                }
            }
        } catch (error) {
            console.error('Error syncing offline data:', error);
        }
    };

    const loadCategories = async () => {
        setIsLoading(true);
        try {
            const storedCategories = await AsyncStorage.getItem('@categories');
            if (storedCategories) {
                const parsedCategories: Category[] = JSON.parse(storedCategories);
                const categoryNames = parsedCategories.map(cat => cat.name.toUpperCase());
                setCategories(categoryNames);
                if (!categoryNames.includes(selectedCategory)) {
                    setSelectedCategory(categoryNames[0] || defaultCategories[0]);
                }
            }
        } catch (error) {
            console.error('Error loading categories:', error);
            setCategories(defaultCategories);
        } finally {
            setIsLoading(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            loadCategories();
        }, [])
    );

    const handleSave = async () => {
        if (!amount || !selectedCategory || !selectedDate) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }

        // Extract the amount using the improved function
        const extractedAmount = extractAmount(amount);
        if (!extractedAmount) {
            Alert.alert('Error', 'Could not extract a valid amount from the text');
            return;
        }

        const newExpense = {
            id: Date.now().toString(),
            amount: extractedAmount,
            category: selectedCategory,
            date: selectedDate,
            note: note || '',
            isSynced: false
        };

        // Step 1: Always save to AsyncStorage first
        try {
            const existingData = await AsyncStorage.getItem('offline_expenses');
            const expenses = existingData ? JSON.parse(existingData) : [];
            expenses.push(newExpense);
            await AsyncStorage.setItem('offline_expenses', JSON.stringify(expenses));
            console.log('Saved to AsyncStorage:', newExpense);
        } catch (error) {
            console.error('Error saving to AsyncStorage:', error);
        }

        // Step 2: Try to save to Firestore if online
        if (isOnline) {
            try {
                const currentUser = auth().currentUser;
                if (currentUser && currentUser.uid) {
                    const docRef = await firestore()
                        .collection('users')
                        .doc(currentUser.uid)
                        .collection('expenses')
                        .add({
                            ...newExpense,
                            isSynced: true
                        });
                    console.log('Saved to Firestore:', docRef.id);
                    
                    // Step 3: Update local storage to mark as synced
                    const existingData = await AsyncStorage.getItem('offline_expenses');
                    const expenses = existingData ? JSON.parse(existingData) : [];
                    const updatedExpenses = expenses.map((exp: any) => 
                        exp.id === newExpense.id ? { ...exp, isSynced: true } : exp
                    );
                    await AsyncStorage.setItem('offline_expenses', JSON.stringify(updatedExpenses));
                }
            } catch (error) {
                console.error('Error saving to Firestore:', error);
            }
        }

        // Reset form
        setAmount('');
        setSelectedCategory('');
        setSelectedDate('');
        setNote('');
        setShowDatePicker(false);
        navigation.navigate('History' as never);
    };

    const renderCategoryButton = ({ item }: { item: string }) => (
        <TouchableOpacity
            style={[
                styles.categoryButton,
                selectedCategory === item && styles.selectedCategory,
            ]}
            onPress={() => setSelectedCategory(item)}
        >
            <Text style={styles.categoryText}>{item}</Text>
        </TouchableOpacity>
    );

    const onDateChange = (_event: any, selected?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selected) {
            const formatted = selected.toLocaleDateString('en-GB');
            setSelectedDate(formatted);
        }
    };

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
                    <Text style={styles.offlineText}>You are offline. Data will sync when online.</Text>
                </View>
            )}
            <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="Enter amount"
                placeholderTextColor={'black'}
            />

            <FlatList
                data={categories}
                renderItem={renderCategoryButton}
                keyExtractor={(item) => item}
                numColumns={4}
                style={styles.categoryList}
            />

            <TouchableOpacity
                style={styles.createButton}
                onPress={() => navigation.navigate('Category' as never)}
            >
                <Text style={styles.createText}>+ CREATE</Text>
            </TouchableOpacity>

            <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={[styles.dateButton, { marginVertical: 15 }]}
            >
                <Text style={styles.dateText}>Selected Date: {selectedDate}</Text>
                <Icon name="calendar" size={20} color="#000" />
            </TouchableOpacity>

            {showDatePicker && (
                <DateTimePicker
                    value={new Date()}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                />
            )}

            <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Note"
                placeholderTextColor={'black'}
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveText}>SAVE</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    container: { 
        flex: 1, 
        padding: 20, 
        backgroundColor: '#fff' 
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
    amountInput: {
        fontSize: 32,
        textAlign: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        padding: 10,
        color: 'black',
    },
    categoryList: {
        marginBottom: 2,
        borderWidth: 2,
        borderColor: 'black',
    },
    categoryButton: {
        flex: 1,
        margin: 5,
        padding: 10,
        backgroundColor: '#e0e0e0',
        borderRadius: 5,
        alignItems: 'center',
    },
    selectedCategory: { backgroundColor: '#4CAF50' },
    categoryText: { fontSize: 12, color: '#000' },
    createButton: {
        height: 40,
        alignSelf: 'center',
        marginVertical: 10,
        borderWidth: 2,
        borderColor: 'black',
        borderRadius: 3,
        backgroundColor: 'black',
        width: '100%',
    },
    createText: {
        paddingTop: 5,
        color: '#888',
        fontSize: 16,
        textAlign: 'center',
    },
    dateButton: {
        backgroundColor: '#e0e0e0',
        borderRadius: 5,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dateText: { fontSize: 16, color: '#000' },
    noteInput: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 10,
        marginVertical: 20,
        fontSize: 16,
        color: 'black',
    },
    saveButton: {
        backgroundColor: '#00CED1',
        padding: 15,
        borderRadius: 5,
        alignItems: 'center',
    },
    saveText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});

export default Homes;
