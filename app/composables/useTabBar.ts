const tabBarHidden = ref(false)

export function useTabBar() {
  function setTabBarHidden(hidden: boolean) {
    tabBarHidden.value = hidden
  }

  return {
    tabBarHidden: readonly(tabBarHidden),
    setTabBarHidden,
  }
}
