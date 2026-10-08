import { createBrowserRouter, RouterProvider, useParams } from 'react-router-dom';
import { ToastProvider } from './components/ToastProvider.jsx';
import { ConfirmProvider } from './components/ConfirmProvider.jsx';
import { StoresProvider } from './components/StoresProvider.jsx';
import { SettingsProvider } from './components/SettingsProvider.jsx';
import { Layout } from './components/Layout.jsx';
import { Hearth } from './screens/Hearth.jsx';
import { StoreScreen } from './screens/StoreScreen.jsx';
import { ItemDetail } from './screens/ItemDetail.jsx';
import { RecipeBox } from './screens/RecipeBox.jsx';
import { RecipeDetail } from './screens/RecipeDetail.jsx';
import { RecipeEditor } from './screens/RecipeEditor.jsx';
import { CanMake } from './screens/CanMake.jsx';
import { Planner } from './screens/Planner.jsx';
import { Shopping } from './screens/Shopping.jsx';
import { Settings } from './screens/Settings.jsx';
import { NotFound } from './screens/NotFound.jsx';

function KeyedStore() {
  const { storeId } = useParams();
  return <StoreScreen key={storeId} />;
}

export const routes = [
  {
    element: <Layout />,
    children: [
      { index: true, element: <Hearth /> },
      { path: 'store/:storeId', element: <KeyedStore /> },
      { path: 'item/:id', element: <ItemDetail /> },
      { path: 'recipes', element: <RecipeBox /> },
      { path: 'recipes/new', element: <RecipeEditor /> },
      { path: 'recipes/:id', element: <RecipeDetail /> },
      { path: 'recipes/:id/edit', element: <RecipeEditor /> },
      { path: 'can-make', element: <CanMake /> },
      { path: 'planner', element: <Planner /> },
      { path: 'shopping', element: <Shopping /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <NotFound /> },
    ],
  },
];

// A data router, so the recipe editor can warn before in-app navigation drops unsaved changes.
const router = createBrowserRouter(routes);

export function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <SettingsProvider>
          <StoresProvider>
            <RouterProvider router={router} />
          </StoresProvider>
        </SettingsProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
