// @ts-nocheck
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Types
type User = {
  id: string;
  username: string;
  password: string;
};

type Note = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

type StorageType = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

// Storage
let AsyncStorageRef: StorageType | null = null;

const createInMemoryStorage = (): StorageType => {
  const store: { [key: string]: string } = {};
  return {
    async getItem(key: string) {
      return store.hasOwnProperty(key) ? store[key] : null;
    },
    async setItem(key: string, value: string) {
      store[key] = value;
    },
    async removeItem(key: string) {
      delete store[key];
    },
  };
};

const STORAGE_USERS = '@rncrud_users';
const STORAGE_CURRENT_USER = '@rncrud_current_user';
const STORAGE_NOTES_PREFIX = '@rncrud_notes_user_';

const SEED_USER: User = { id: 'u_test', username: 'test', password: 'test123' };

export default function HomeScreen() {
  const [storageReady, setStorageReady] = useState(false);
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      await setupStorage();
      await initStorage();
      await loadCurrentUser();
      setStorageReady(true);
    })();
  }, []);

  useEffect(() => {
    if (user) loadNotes();
  }, [user]);

  const setupStorage = async () => {
    try {
      const mod = await import('@react-native-async-storage/async-storage');
      AsyncStorageRef = mod.default || mod;
    } catch (e) {
      console.warn('Using in-memory storage');
      AsyncStorageRef = createInMemoryStorage();
    }
  };

  const initStorage = async () => {
    try {
      const raw = await AsyncStorageRef!.getItem(STORAGE_USERS);
      if (!raw) {
        await AsyncStorageRef!.setItem(STORAGE_USERS, JSON.stringify([SEED_USER]));
      }
    } catch (e) {
      console.error('initStorage error', e);
    }
  };

  const getUsers = async (): Promise<User[]> => {
    try {
      const raw = await AsyncStorageRef!.getItem(STORAGE_USERS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  const saveUsers = async (users: User[]) => {
    try {
      await AsyncStorageRef!.setItem(STORAGE_USERS, JSON.stringify(users));
    } catch (e) {
      console.error('saveUsers', e);
    }
  };

  const notesKey = (userId: string) => `${STORAGE_NOTES_PREFIX}${userId}`;

  const getNotesForUser = async (userId: string): Promise<Note[]> => {
    try {
      const raw = await AsyncStorageRef!.getItem(notesKey(userId));
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  };

  const saveNotesForUser = async (userId: string, notesArray: Note[]) => {
    try {
      await AsyncStorageRef!.setItem(notesKey(userId), JSON.stringify(notesArray));
    } catch (e) {
      console.error('saveNotesForUser', e);
    }
  };

  const register = async () => {
    const username = authUsername.trim();
    const password = authPassword;
    if (!username || !password) return Alert.alert('Error', 'Provide username and password');

    try {
      const users = await getUsers();
      if (users.find((u: User) => u.username === username)) {
        return Alert.alert('Error', 'Username already exists');
      }
      const newUser: User = { id: `u_${Date.now()}`, username, password };
      users.push(newUser);
      await saveUsers(users);
      Alert.alert('Success', 'Account created. You can now login.');
      setAuthMode('login');
      setAuthPassword('');
      setAuthUsername('');
    } catch (e) {
      Alert.alert('Error', 'Could not create account');
    }
  };

  const login = async () => {
    const username = authUsername.trim();
    const password = authPassword;
    if (!username || !password) return Alert.alert('Error', 'Provide username and password');

    try {
      const users = await getUsers();
      const found = users.find((u: User) => u.username === username && u.password === password);
      if (found) {
        await AsyncStorageRef!.setItem(STORAGE_CURRENT_USER, JSON.stringify({ id: found.id, username: found.username }));
        setUser({ id: found.id, username: found.username });
        setAuthPassword('');
        setAuthUsername('');
      } else {
        Alert.alert('Error', 'Invalid username or password');
      }
    } catch (e) {
      Alert.alert('Error', 'Login failed');
    }
  };

  const logout = async () => {
    try {
      await AsyncStorageRef!.removeItem(STORAGE_CURRENT_USER);
      setUser(null);
      setNotes([]);
    } catch (e) {
      console.error('logout error', e);
    }
  };

  const loadCurrentUser = async () => {
    try {
      const raw = await AsyncStorageRef!.getItem(STORAGE_CURRENT_USER);
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {
      console.error('Load user error', e);
    }
  };

  const loadNotes = async () => {
    if (!user) return;
    const arr = await getNotesForUser(user.id);
    arr.sort((a: Note, b: Note) => (b.created_at || '').localeCompare(a.created_at || ''));
    setNotes(arr);
  };

  const createNote = async () => {
    if (!title.trim()) return Alert.alert('Error', 'Title required');
    try {
      const createdAt = new Date().toISOString();
      const newNote: Note = { id: `n_${Date.now()}`, title: title.trim(), body, created_at: createdAt };
      const arr = await getNotesForUser(user!.id);
      arr.unshift(newNote);
      await saveNotesForUser(user!.id, arr);
      setTitle('');
      setBody('');
      setModalVisible(false);
      setNotes(arr);
    } catch (e) {
      console.error('Create note', e);
    }
  };

  const updateNote = async () => {
    if (!title.trim()) return Alert.alert('Error', 'Title required');
    try {
      const arr = await getNotesForUser(user!.id);
      const idx = arr.findIndex((n: Note) => n.id === editingId);
      if (idx === -1) return Alert.alert('Error', 'Note not found');
      arr[idx] = { ...arr[idx], title: title.trim(), body };
      await saveNotesForUser(user!.id, arr);
      setEditingId(null);
      setTitle('');
      setBody('');
      setModalVisible(false);
      setNotes(arr);
    } catch (e) {
      console.error('Update note', e);
    }
  };

  const deleteNote = (id: string) => {
    Alert.alert('Delete', 'Delete this note?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const arr = await getNotesForUser(user!.id);
            const filtered = arr.filter((n: Note) => n.id !== id);
            await saveNotesForUser(user!.id, filtered);
            setNotes(filtered);
          } catch (e) {
            console.error('Delete note', e);
          }
        },
      },
    ]);
  };

  const openAdd = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setModalVisible(true);
  };

  const openEdit = (note: Note) => {
    setEditingId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setModalVisible(true);
  };

  if (!storageReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ padding: 20 }}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.authContainer}>
          <Text style={styles.headerTitle}>Notes App</Text>

          <View style={{ marginTop: 20 }}>
            <TextInput 
              placeholder="Username" 
              value={authUsername} 
              onChangeText={setAuthUsername} 
              style={styles.input} 
              autoCapitalize="none" 
            />
            <TextInput 
              placeholder="Password" 
              value={authPassword} 
              onChangeText={setAuthPassword} 
              style={styles.input} 
              secureTextEntry 
            />

            {authMode === 'login' ? (
              <>
                <TouchableOpacity style={styles.btn} onPress={login}>
                  <Text style={{ color: 'white', fontWeight: '700' }}>Login</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#6b7280' }]} onPress={() => setAuthMode('register')}>
                  <Text style={{ color: 'white' }}>Create Account</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.btn} onPress={register}>
                  <Text style={{ color: 'white', fontWeight: '700' }}>Register</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#6b7280' }]} onPress={() => setAuthMode('login')}>
                  <Text style={{ color: 'white' }}>Back to Login</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const renderItem = ({ item }: { item: Note }) => (
    <View style={styles.noteCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.noteTitle}>{item.title}</Text>
        {item.body ? <Text style={styles.noteBody}>{item.body}</Text> : null}
        <Text style={styles.noteDate}>{new Date(item.created_at).toLocaleString()}</Text>
      </View>

      <View style={styles.cardButtons}>
        <TouchableOpacity style={styles.smallBtn} onPress={() => openEdit(item)}>
          <Text>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.smallBtn, { marginTop: 8 }]} onPress={() => deleteNote(item.id)}>
          <Text style={{ color: '#ef4444' }}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Hello, {user.username}</Text>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity style={[styles.btn, { minWidth: 60 }]} onPress={openAdd}>
            <Text style={{ color: 'white', fontWeight: '700' }}>+ Add</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: '#ef4444', marginLeft: 8 }]} onPress={logout}>
            <Text style={{ color: 'white', fontWeight: '700' }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={() => (
          <View style={{ alignItems: 'center', marginTop: 40 }}>
            <Text>No notes yet. Tap Add to create one.</Text>
          </View>
        )}
      />

      <Modal animationType="slide" visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
            <View style={{ padding: 16 }}>
              <Text style={styles.modalTitle}>{editingId ? 'Edit Note' : 'New Note'}</Text>

              <TextInput 
                placeholder="Title" 
                value={title} 
                onChangeText={setTitle} 
                style={styles.input} 
                maxLength={120} 
              />

              <TextInput 
                placeholder="Body (optional)" 
                value={body} 
                onChangeText={setBody} 
                style={[styles.input, { height: 120 }]} 
                multiline 
                textAlignVertical="top"
              />

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 }}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: '#bbb' }]} onPress={() => setModalVisible(false)}>
                  <Text>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.btn}
                  onPress={editingId ? updateNote : createNote}
                >
                  <Text style={{ color: 'white', fontWeight: '600' }}>{editingId ? 'Update' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f2f4f8' 
  },
  authContainer: { 
    padding: 24,
    flex: 1,
    justifyContent: 'center'
  },
  headerRow: { 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700',
    textAlign: 'center'
  },
  btn: { 
    backgroundColor: '#2563eb', 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    marginTop: 12,
    alignItems: 'center'
  },
  noteCard: { 
    backgroundColor: 'white', 
    padding: 16, 
    borderRadius: 8, 
    marginBottom: 12, 
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2
  },
  noteTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    marginBottom: 4 
  },
  noteBody: { 
    color: '#374151',
    marginTop: 4
  },
  noteDate: { 
    marginTop: 8, 
    fontSize: 11, 
    color: '#6b7280' 
  },
  cardButtons: { 
    marginLeft: 12, 
    justifyContent: 'center' 
  },
  smallBtn: { 
    borderWidth: 1, 
    borderColor: '#ddd', 
    padding: 8, 
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 60
  },
  modalContainer: { 
    flex: 1, 
    backgroundColor: 'white' 
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    marginBottom: 16 
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#e5e7eb', 
    backgroundColor: '#fff', 
    padding: 12, 
    borderRadius: 8, 
    marginBottom: 12,
    fontSize: 16
  },
});