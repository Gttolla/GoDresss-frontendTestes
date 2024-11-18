import { View, Text, TouchableOpacity } from 'react-native'
import { router } from 'expo-router'
import React, { useState } from 'react'

import { useClothes } from '@/src/services/contexts/clothesContext'
import { globalColors, globalStyles } from '@/src/styles/global'
import { Ionicons } from '@expo/vector-icons'
import ClothesList from '../components/flatLists/clothesList'
import Api from '@/src/services/api'
import Toast from 'react-native-toast-message'

export default function DirtyClothes() {
  const [loading, setLoading] = useState(false);

  const { clothes, getClothes, selectedClothesIds } = useClothes();

  const filteredClothes = clothes.filter(item => item.dirty === true);

  const onSubmitWashClothes = async () => {
    setLoading(true);

    const currentClothes = filteredClothes.map(item => item._id);

    await Api.put(`/clothing/${selectedClothesIds.length > 0 ? selectedClothesIds : currentClothes}`, { dirty: false })
      .then((response) => {
        console.log(response.data.msg);
        getClothes();
      })
      .catch(error => {
        console.log(error.response.data);
        Toast.show({
          type: 'error',
          text1: error.reponse.data,
          text2: 'Tente novamente'
        });
      })
      .finally(() => {
        setLoading(false);

        Toast.show({
          type: 'success',
          text1: 'Sucesso',
          text2: 'Roupas lavadas'
        });
      });
  }
  return (
    <View style={{ flex: 1, paddingTop: 50, paddingBottom: 20 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name='chevron-back' size={30} color={globalColors.primary} />
        </TouchableOpacity>
        <Text style={globalStyles.mainTitle}>Roupas sujas</Text>
      </View>

      {filteredClothes.length === 0 ?
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text>Não há roupas sujas</Text>
        </View>
        :
        <View style={{ flex: 1, marginTop: 20 }}>
          <ClothesList clothes={filteredClothes} clothingBg='#fff' canSelect={true} canOpen={true} operations={["delete", "fav"]} showButton={true} buttonTitle={selectedClothesIds.length === 0 ? "Lavar todas as roupas" : "Lavar roupas selecionadas"} buttonOnPress={onSubmitWashClothes} buttonLoading={loading} />
        </View>
      }
    </View>
  )
}