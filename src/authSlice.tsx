import { createSlice } from '@reduxjs/toolkit';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    idToken: null,
    userId: null,
  },
  reducers: {
    setIdToken: (state, action) => {
      state.idToken = action.payload;
    },
    setUserId: (state, action) => {
      state.userId = action.payload;
    },
    logout: (state) => {
      state.idToken = null;
      state.userId = null;
    },

  },
});

export const { setIdToken, setUserId, logout } = authSlice.actions;

export default authSlice.reducer;