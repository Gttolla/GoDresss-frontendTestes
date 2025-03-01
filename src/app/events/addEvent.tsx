import React, { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as yup from 'yup';
import { View, Text, TouchableOpacity, Dimensions, ImageBackground, ScrollView, TextInput, StyleSheet, FlatList, ActivityIndicator, Image } from 'react-native';
import { yupResolver } from '@hookform/resolvers/yup';
import { useForm, Controller, SubmitHandler } from 'react-hook-form';
import DateTimePicker from 'react-native-ui-datepicker';
import dayjs from 'dayjs';
import localizedFormat from "dayjs/plugin/localizedFormat"
import Toast from 'react-native-toast-message';

import axios from 'axios';
import Api from '@/src/services/api';
import MyButton from '../components/button/button';
import Modal from '../components/modals/modal';
import MainHeader from '../components/headers/mainHeader';
import { FontAwesome5, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { globalColors, globalStyles } from '@/src/styles/global';
import { Picker } from '@react-native-picker/picker';
import { brazilianStates } from '@/src/services/local-data/pickerData';
import { Clothing } from '@/src/services/types/types';
import { useOutfits } from '@/src/services/contexts/outfitsContext';
import { STORAGE } from '@/src/services/firebase/firebaseConfig';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { router } from 'expo-router';
import { useEvents } from '@/src/services/contexts/eventsContext';

const { width } = Dimensions.get('window');

dayjs.extend(localizedFormat);

type FormData = {
  outfitId?: string;
  image?: string;
  name: string;
  date: Date;
  location: string;
};

type Location = {
  nome: string;
  codigo_ibge: string;
};

const registerSchema = yup.object({
  outfitId: yup.string().optional(),
  image: yup.string().optional(),
  name: yup.string().required('Nome é obrigatório'),
  date: yup.date().required('Data é obrigatória'),
  location: yup.string().required('Local é obrigatório'),
}).required();

export const autoCapitalizer = (str: string) => {
  return str
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function AddEvent() {
  const [image, setImage] = useState<string | null>(null);
  const [openDatePicker, setOpenDatePicker] = useState<boolean>(false);
  const [openLocationPicker, setOpenLocationPicker] = useState<boolean>(false);
  const [state, setState] = useState<string>("");
  const [searchValue, setSearchValue] = useState<string>("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [outfitLoading, setOutfitLoading] = useState<boolean>(false);
  const [outfitsRecomendations, setOutfitsRecomendations] = useState<Clothing[][]>([]);
  const [eventOutfit, setEventOutfit] = useState<Clothing[]>([]);
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);

  const { outfits, getOutfits } = useOutfits();
  const { getEvents } = useEvents();

  const form = useForm<FormData>({
    defaultValues: {
      outfitId: '',
      image: '',
      name: '',
      date: undefined,
      location: '',
    },
    resolver: yupResolver(registerSchema),
  });

  const { handleSubmit, control, formState: { errors }, reset, setValue, watch, getValues } = form;

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
        setValue('image', result.assets[0].uri);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const getLocations = async () => {
    if (!state) return;
    setSearchLoading(true);

    await axios.get(`https://brasilapi.com.br/api/ibge/municipios/v1/${state}`)
      .then(response => {
        setLocations(response.data);
      })
      .catch(error => {
        console.log(error);
      })
      .finally(() => {
        setSearchLoading(false);
      });
  };

  const handleGenerateOutfitsRecommendation = async () => {
    const hour = dayjs(watch("date")).hour();
    setOutfitLoading(true);

    await Api.post("/outfit/generate_outfit", {
      temperature: watch("date"),
      location: watch("location"),
      hour: hour,
      generateMultiple: true,
    })
      .then(response => {
        setOutfitsRecomendations(response.data.outfits);
      })
      .catch(error => {
        console.log(error.response.data.msg);
        Toast.show({
          type: "error",
          text1: "Erro ao gerar recomendação de outfits",
          text2: "Tente novamente mais tarde",
        })
        return
      })
      .finally(() => {
        setOutfitLoading(false);
      });
  };

  const handleSaveOutfit = async () => {
    setSubmitLoading(true);
    const hour = dayjs(watch("date")).hour();

    await Api.post('/outfit', {
      clothingId: eventOutfit,
      name: `${watch("name")} - Outfit`,
      temperature: watch("date"),
      hour: hour,
    })
      .then(response => {
        setValue("outfitId", response.data._id);
        console.log(response.data._id);
      })
      .catch(error => {
        console.log(error.response.data.msg)
        Toast.show({
          type: "error",
          text1: error.response.data.msg,
          text2: "Tente novamente"
        })
      })
  };

  const uploadImage = async (uri: string): Promise<string | undefined> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();

      const storageRef = ref(STORAGE, `events/${Date.now()}`);
      const snapshot = await uploadBytes(storageRef, blob);

      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.log(error);
    }
  };

  const onSubmitCreateEvent: SubmitHandler<FormData> = async (data) => {
    setSubmitLoading(true)

    const outfitExists = outfits.find((item) =>
      JSON.stringify(item.clothingId) === JSON.stringify(eventOutfit)
    );

    if (!outfitExists) {
      await handleSaveOutfit()
    }
    else {
      setValue("outfitId", outfitExists._id);
      console.log(outfitExists._id);
    }

    if (image) {
      const imageUrl = await uploadImage(image);
      setValue("image", imageUrl);
    }

    await Api.post("/event", data)
      .then((response) => {
        console.log(response.data);
        reset();
        setImage(null);
        setEventOutfit([]);
        setOutfitsRecomendations([]);
        getEvents();
        getOutfits();
        router.back();
      })
      .catch((error) => {
        console.log(error.response.data.msg);
        Toast.show({
          type: "error",
          text1: error.response.data.msg,
          text2: "Tente novamente"
        })

        if (error.response.data.msg !== "Adicione um outfit") {
          reset();
          setImage(null);
          setEventOutfit([]);
          setOutfitsRecomendations([]);
          setState("");
          setLocations([]);
        }
      })
      .finally(() => {
        setSubmitLoading(false)
      })
  };

  useEffect(() => {
    if (state) {
      getLocations();
    }
  }, [state]);

  useEffect(() => {
    if (searchValue) {
      const filteredLocations = locations.filter(item => item.nome.toLowerCase().includes(searchValue.toLowerCase()));
      setLocations(filteredLocations);
    } else {
      getLocations();
    }
  }, [searchValue]);

  useEffect(() => {
    if (watch("date") && watch("location") && watch("name")) {
      handleGenerateOutfitsRecommendation();
    }
  }, [watch("date"), watch("location"), watch("name")]);

  return (
    <View style={globalStyles.globalContainer}>
      <View style={{ marginBottom: 30 }}>
        <MainHeader title="Adicionar evento" backButton={true} />
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={{ borderWidth: 2, borderStyle: image ? "solid" : "dashed", height: width * 0.6, borderRadius: 10, borderColor: globalColors.primary, alignItems: 'center', justifyContent: 'center', }} onPress={pickImage} >
          {image ? (
            <ImageBackground source={{ uri: image }} style={{ width: '100%', height: '100%', alignItems: 'flex-end' }}>
              <TouchableOpacity style={{ margin: 10, backgroundColor: "#fff", padding: 2, borderRadius: 3 }} onPress={() => setImage(null)}>
                <FontAwesome5 name="trash" size={20} color={globalColors.primary} />
              </TouchableOpacity>
            </ImageBackground>
          ) : (
            <View style={{ alignItems: 'center', gap: 5 }}>
              <FontAwesome5 name="camera" size={25} color={globalColors.primary} />
              <Text style={{ color: globalColors.primary }}>Adicionar foto</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={{ marginTop: 20, gap: 10 }}>
          <Controller
            control={control}
            name="name"
            render={({ field: { value, onChange } }) => (
              <View style={{ gap: 5 }}>
                <View style={globalStyles.inputArea}>
                  <TextInput style={globalStyles.input} onChangeText={onChange} placeholder="Nome" value={value} autoCapitalize="words" />
                </View>
                {errors.name && <Text style={globalStyles.error}>{errors.name.message}</Text>}
              </View>
            )}
          />
          <View style={{ gap: 5 }}>
            <TouchableOpacity style={globalStyles.inputArea} onPress={() => setOpenDatePicker(true)}>
              <Text style={globalStyles.input}>
                {watch("date")
                  ? dayjs(watch("date")).format("DD/MM/YYYY HH:mm")
                  : "Selecionar data"}
              </Text>
            </TouchableOpacity>
            {errors.date && <Text style={globalStyles.error}>{errors.date.message}</Text>}
          </View>
          <View style={{ gap: 5 }}>
            <TouchableOpacity style={globalStyles.inputArea} onPress={() => setOpenLocationPicker(true)}>
              <Text style={globalStyles.input}>
                {watch("location")
                  ? getValues("location")
                  : "Local"
                }
              </Text>
            </TouchableOpacity>
            {errors.location && <Text style={globalStyles.error}>{errors.location.message}</Text>}
          </View>
        </View>

        <View style={{ marginTop: 40 }}>
          <View style={{ marginBottom: 20, flexDirection: "row", justifyContent: "space-between", width: "100%" }}>
            <Text style={globalStyles.subTitle}>Sugestões de outfits</Text>
            {outfitsRecomendations.length > 0 && !outfitLoading &&
              <TouchableOpacity onPress={handleGenerateOutfitsRecommendation}>
                <FontAwesome name="refresh" size={20} color={globalColors.primary} />
              </TouchableOpacity>
            }
          </View>

          <View style={{ flex: 1 }}>
            {outfitsRecomendations.length === 0 && !outfitLoading &&
              <View>
                <Text>Preencha todos os campos para receber sujestões de outfits</Text>
              </View>
            }
            {outfitLoading &&
              <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator size={50} color={globalColors.primary} />
              </View>
            }
            {outfitsRecomendations.length > 0 && !outfitLoading &&
              <FlatList
                data={outfitsRecomendations}
                keyExtractor={(item, index) => `outfit-${index}`}
                renderItem={({ item: outfit, index }) => (
                  <TouchableOpacity style={[globalStyles.tinyStyledContainer, { marginBottom: 20, width: "100%", paddingVertical: 10 }]} onPress={() => eventOutfit !== outfit ? setEventOutfit(outfit) : setEventOutfit([])}>
                    <Text style={{ fontWeight: "bold", fontSize: 16, marginVertical: 5 }}>Outfit {index + 1}</Text>
                    <FlatList
                      data={outfit}
                      keyExtractor={(clothing) => clothing._id}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      renderItem={({ item: clothing }) => (
                        <View style={{ marginHorizontal: 8, alignItems: "center" }}>
                          <Image
                            source={{ uri: clothing.image }}
                            style={{ width: width * 0.25, height: width * 0.25, borderRadius: 8 }}
                          />
                        </View>
                      )}
                    />
                    {eventOutfit === outfit &&
                      <MaterialIcons name="check-circle" color={globalColors.primary} size={26} style={{ position: "absolute", right: 1, bottom: 1, backgroundColor: "#fff", borderRadius: 100 }} />
                    }
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
              />
            }
          </View>
        </View>
      </ScrollView>

      <MyButton title="Adicionar evento" onPress={handleSubmit(onSubmitCreateEvent)} loading={submitLoading} />

      <Modal isOpen={openDatePicker} onRequestClose={() => setOpenDatePicker(false)}>
        <View style={[globalStyles.tinyStyledContainer, { width: "90%", paddingVertical: 10, paddingHorizontal: 10 }]}>
          <DateTimePicker
            mode="single"
            timePicker={true}
            date={watch("date") || new Date()}
            onChange={(params) => {
              if (params.date) {
                const selectedDate = dayjs(params.date).toDate();
                setValue("date", selectedDate, { shouldValidate: true });
              }
            }}
            selectedItemColor={globalColors.primary}
            minDate={new Date()}
          />

          <View style={{ paddingHorizontal: 10, width: "100%" }}>
            <MyButton title="Salvar" onPress={() => setOpenDatePicker(false)} />
          </View>
        </View>
      </Modal>

      <Modal isOpen={openLocationPicker} onRequestClose={() => setOpenLocationPicker(false)}>
        <View style={[globalStyles.tinyStyledContainer, { width: "90%", paddingTop: 10, paddingHorizontal: 10 }]}>
          <View style={[globalStyles.pickerContainer, { marginBottom: 20, width: "100%" }]}>
            <Picker
              selectedValue={state}
              onValueChange={(itemValue) => { setState(itemValue) }}
            >
              <Picker.Item label="Estado" value="" />
              {brazilianStates.map(item => (
                <Picker.Item key={item.value} label={item.label} value={item.value} />
              ))}
            </Picker>
          </View>

          <View>
            <View style={styles.searchInputArea}>
              <FontAwesome5 name="search" size={20} color={globalColors.primary} />
              <TextInput style={globalStyles.input} placeholder="Pesquisar" value={searchValue} onChangeText={(text) => setSearchValue(text)} />
            </View>

            <View style={{ height: 300 }}>
              {locations.length === 0 && !searchLoading &&
                <View style={globalStyles.message}>
                  <Text style={{ textAlign: "center", marginTop: 20 }}>Nenhum local encontrado</Text>
                </View>
              }
              {searchLoading ?
                <View style={{ position: "absolute", width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>
                  <ActivityIndicator size={100} color={globalColors.primary} />
                </View>
                :
                <FlatList
                  data={locations}
                  keyExtractor={item => item.codigo_ibge}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: globalColors.primary }} onPress={() => {
                      setValue("location", autoCapitalizer(item.nome), { shouldValidate: true });
                      setOpenLocationPicker(false);
                    }}>
                      <Text>{autoCapitalizer(item.nome)}</Text>
                    </TouchableOpacity>
                  )}
                />
              }
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  searchInputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#fff",
    paddingVertical: 3,
    paddingHorizontal: 10,
    width: "100%",
    borderWidth: 1,
    borderRadius: 10,
    borderColor: globalColors.primary,
    justifyContent: 'space-between',
  }
});