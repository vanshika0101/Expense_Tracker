import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';

interface CategoryItem {
  id: number;
  name: string;
  color: string;
}

const defaultColors = ['yellow', 'green', 'orange', 'blue'];
const STORAGE_KEY = '@categories';

export default function Category() {
  const [categories, setCategories] = useState<CategoryItem[]>([
    { id: 1, name: 'Loan', color: 'yellow' },
    { id: 2, name: 'Transport', color: 'green' },
    { id: 3, name: 'Food', color: 'orange' },
    { id: 4, name: 'Education', color: 'blue' },
  ]);

  const [searchText, setSearchText] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [selectedColor, setSelectedColor] = useState('yellow');
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [editText, setEditText] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Load categories from AsyncStorage when component mounts
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const storedCategories = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedCategories) {
        setCategories(JSON.parse(storedCategories));
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      Alert.alert('Error', 'Failed to load categories');
    }
  };

  const saveCategories = async (updatedCategories: CategoryItem[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedCategories));
    } catch (error) {
      console.error('Error saving categories:', error);
      Alert.alert('Error', 'Failed to save categories');
    }
  };

  const addCategory = async () => {
    if (newCategory.trim() === '') {
      Alert.alert('Error', 'Please enter a category name');
      return;
    }

    if (categories.some(cat => cat.name.toLowerCase() === newCategory.toLowerCase())) {
      Alert.alert('Error', 'Category already exists');
      return;
    }

    const newItem: CategoryItem = {
      id: Date.now(),
      name: newCategory.trim(),
      color: selectedColor,
    };
    
    const updatedCategories = [...categories, newItem];
    setCategories(updatedCategories);
    await saveCategories(updatedCategories);
    
    setNewCategory('');
    Alert.alert('Success', 'Category added successfully');
  };

  const deleteCategory = async (id: number) => {
    Alert.alert(
      'Delete Category',
      'Are you sure you want to delete this category?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedCategories = categories.filter(item => item.id !== id);
            setCategories(updatedCategories);
            await saveCategories(updatedCategories);
          },
        },
      ]
    );
  };

  const startEditing = (category: CategoryItem) => {
    setEditingCategory(category);
    setEditText(category.name);
  };

  const saveEdit = async () => {
    if (!editingCategory) return;

    if (editText.trim() === '') {
      Alert.alert('Error', 'Category name cannot be empty');
      return;
    }

    if (categories.some(cat => 
      cat.name.toLowerCase() === editText.toLowerCase() && 
      cat.id !== editingCategory.id
    )) {
      Alert.alert('Error', 'Category name already exists');
      return;
    }

    const updatedCategories = categories.map(cat =>
      cat.id === editingCategory.id ? { ...cat, name: editText.trim() } : cat
    );
    
    setCategories(updatedCategories);
    await saveCategories(updatedCategories);
    
    setEditingCategory(null);
    setEditText('');
  };

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchText.toLowerCase())
  );

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await auth().signOut();
      // The auth state listener in App.tsx will handle navigation
      Alert.alert('Success', 'You have been logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.input}
          placeholder="Search"
          value={searchText}
          onChangeText={setSearchText}
          placeholderTextColor={'black'}
        />
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="New Category"
          value={newCategory}
          onChangeText={setNewCategory}
          placeholderTextColor={'black'}
        />
        <View style={styles.colorPicker}>
          {defaultColors.map(color => (
            <TouchableOpacity
              key={color}
              onPress={() => setSelectedColor(color)}
              style={[
                styles.colorCircle,
                {
                  backgroundColor: color,
                  borderWidth: selectedColor === color ? 2 : 0,
                  borderColor: 'black',
                },
              ]}
            />
          ))}
        </View>
        <TouchableOpacity style={styles.addButton} onPress={addCategory}>
          <Text style={{ color: 'white' }}>ADD</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredCategories}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.itemLeft}>
              <View
                style={[styles.dot, { backgroundColor: item.color }]}
              />
              <Text style={{color:'black'}}>{item.name}</Text>
            </View>
            <View style={styles.buttons}>
              <TouchableOpacity onPress={() => startEditing(item)}>
                <Text style={styles.edit}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteCategory(item.id)}>
                <Text style={styles.delete}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity 
        style={styles.logoutButton}
        onPress={() => {
          Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
              {
                text: 'Cancel',
                style: 'cancel',
              },
              {
                text: 'Logout',
                style: 'destructive',
                onPress: handleLogout,
              },
            ]
          );
        }}
        disabled={isLoggingOut}
      >
        {isLoggingOut ? (
          <ActivityIndicator color="white" size="small" />
        ) : (
          <Text style={styles.logoutButtonText}>Logout</Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={!!editingCategory}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditingCategory(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Category</Text>
            <TextInput
              style={styles.modalInput}
              value={editText}
              onChangeText={setEditText}
              placeholder="Category name"
              placeholderTextColor={'black'}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setEditingCategory(null);
                  setEditText('');
                }}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveEdit}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flex: 1 },
  searchRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#999',
    padding: 8,
    borderRadius: 6,
    color:'black',
  },
  addButton: {
    backgroundColor: 'teal',
    padding: 10,
    marginLeft: 8,
    borderRadius: 6,
  },
  colorPicker: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  colorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginHorizontal: 2,
  },
  item: {
    flexDirection: 'row',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    marginBottom: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
    color:'black',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    color:'black',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  buttons: {
    flexDirection: 'row',
    gap: 10,
  },
  edit: {
    fontSize: 18,
    marginRight: 10,
  },
  delete: {
    fontSize: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#999',
    padding: 10,
    borderRadius: 6,
    marginBottom: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    padding: 10,
    borderRadius: 6,
    minWidth: 100,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#ccc',
  },
  saveButton: {
    backgroundColor: 'teal',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
